import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileRecordEntity } from '../entities/file-record.entity';
import { FileVersionEntity } from '../entities/file-version.entity';
import { StorageQuotaEntity } from '../entities/storage-quota.entity';
import { IStorageProvider } from '../storage/storage.interface';
import { VirusScannerService } from './virus-scanner.service';
import { ImageOptimizationService } from './image-optimization.service';
import { FileValidatorService } from './file-validator.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileRecordEntity)
    private readonly fileRecordRepo: Repository<FileRecordEntity>,
    @InjectRepository(FileVersionEntity)
    private readonly fileVersionRepo: Repository<FileVersionEntity>,
    @InjectRepository(StorageQuotaEntity)
    private readonly storageQuotaRepo: Repository<StorageQuotaEntity>,
    @Inject('IStorageProvider')
    private readonly storageProvider: IStorageProvider,
    private readonly virusScanner: VirusScannerService,
    private readonly imageOptimizer: ImageOptimizationService,
    private readonly fileValidator: FileValidatorService,
  ) {}

  async uploadFile(userId: string, originalName: string, mimeType: string, buffer: Buffer): Promise<FileRecordEntity> {
    this.fileValidator.validateFile(mimeType, buffer.length);
    await this.checkStorageQuota(userId, buffer.length);

    // 1. Virus Scan
    const scanResult = await this.virusScanner.scanBuffer(buffer);
    if (scanResult.isInfected) {
      throw new BadRequestException(`Virus detected! Viruses: ${scanResult.viruses.join(', ')}`);
    }

    // 2. Optimization
    const { buffer: processedBuffer, isCompressed } = await this.imageOptimizer.optimizeImage(buffer, mimeType);
    
    // 3. Store the file
    const fileId = uuidv4();
    const ext = path.extname(originalName);
    const storagePath = `users/${userId}/${fileId}${ext}`;
    
    await this.storageProvider.upload(storagePath, processedBuffer, mimeType);

    // 4. Update Database
    const fileRecord = this.fileRecordRepo.create({
      userId,
      originalName,
      mimeType,
      size: processedBuffer.length,
      storageProvider: process.env.STORAGE_PROVIDER || 'local',
      storagePath,
      cdnUrl: this.generateCdnUrl(storagePath),
      isCompressed,
      isScanned: true,
      isInfected: false,
    });

    await this.fileRecordRepo.save(fileRecord);
    await this.updateStorageQuota(userId, processedBuffer.length);

    return fileRecord;
  }

  // --- Chunked Upload Logic ---
  async initializeChunkedUpload(userId: string, originalName: string, mimeType: string, totalSize: number): Promise<{ uploadId: string, storagePath: string }> {
    this.fileValidator.validateFile(mimeType, totalSize);
    await this.checkStorageQuota(userId, totalSize);

    const fileId = uuidv4();
    const ext = path.extname(originalName);
    const storagePath = `users/${userId}/${fileId}${ext}`;

    const uploadId = await this.storageProvider.initializeMultipartUpload(storagePath, mimeType);
    return { uploadId, storagePath };
  }

  async uploadChunk(userId: string, uploadId: string, partNumber: number, buffer: Buffer): Promise<any> {
    this.fileValidator.validateChunkSize(buffer.length);
    // Ideally we would virus scan each chunk or reassemble in memory. 
    // Scanning chunks directly with Clamscan may not detect spanning signatures,
    // so in a real-world high-security env we'd scan the reassembled file in storage.
    return this.storageProvider.uploadChunk(uploadId, partNumber, buffer);
  }

  async completeChunkedUpload(userId: string, uploadId: string, storagePath: string, originalName: string, mimeType: string, totalSize: number, parts: any[]): Promise<FileRecordEntity> {
    await this.storageProvider.completeMultipartUpload(uploadId, storagePath, parts);

    const fileRecord = this.fileRecordRepo.create({
      userId,
      originalName,
      mimeType,
      size: totalSize,
      storageProvider: process.env.STORAGE_PROVIDER || 'local',
      storagePath,
      cdnUrl: this.generateCdnUrl(storagePath),
      isCompressed: false, // Large files typically bypass aggressive compression
      isScanned: false, // Should trigger an async scan job
    });

    await this.fileRecordRepo.save(fileRecord);
    await this.updateStorageQuota(userId, totalSize);

    return fileRecord;
  }

  // --- Retrieval & Delivery ---
  async getFile(userId: string, fileId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const file = await this.fileRecordRepo.findOne({ where: { id: fileId, isDeleted: false } });
    if (!file) throw new NotFoundException('File not found');
    if (file.userId !== userId) throw new ForbiddenException('Access denied');

    const buffer = await this.storageProvider.download(file.storagePath);
    return { buffer, mimeType: file.mimeType };
  }

  async getSignedUrl(userId: string, fileId: string): Promise<string> {
    const file = await this.fileRecordRepo.findOne({ where: { id: fileId, isDeleted: false } });
    if (!file) throw new NotFoundException('File not found');
    if (file.userId !== userId) throw new ForbiddenException('Access denied');

    return this.storageProvider.getSignedUrl(file.storagePath, 3600); // 1 hour
  }

  // --- Deletion & Quota ---
  async deleteFile(userId: string, fileId: string): Promise<void> {
    const file = await this.fileRecordRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (file.userId !== userId) throw new ForbiddenException('Access denied');

    // Soft delete
    file.isDeleted = true;
    await this.fileRecordRepo.save(file);
    
    // The GarbageCollector cron job will physically remove it after the retention period.
  }

  private async checkStorageQuota(userId: string, additionalBytes: number) {
    let quota = await this.storageQuotaRepo.findOne({ where: { userId } });
    if (!quota) {
      quota = this.storageQuotaRepo.create({ userId, usedBytes: 0 });
      await this.storageQuotaRepo.save(quota);
    }
    
    if (Number(quota.usedBytes) + additionalBytes > Number(quota.maxBytes)) {
      throw new BadRequestException('Storage quota exceeded');
    }
  }

  private async updateStorageQuota(userId: string, bytesAdded: number) {
    const quota = await this.storageQuotaRepo.findOne({ where: { userId } });
    if (quota) {
      quota.usedBytes = Number(quota.usedBytes) + bytesAdded;
      await this.storageQuotaRepo.save(quota);
    }
  }

  private generateCdnUrl(storagePath: string): string | undefined {
    const cdnBase = process.env.CDN_BASE_URL;
    if (cdnBase) {
      return `${cdnBase}/${storagePath}`;
    }
    return undefined;
  }
}
