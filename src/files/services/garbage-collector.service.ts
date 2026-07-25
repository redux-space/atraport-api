import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { FileRecordEntity } from '../entities/file-record.entity';
import { IStorageProvider } from '../storage/storage.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class GarbageCollectorService {
  private readonly logger = new Logger(GarbageCollectorService.name);
  
  // Retention period for soft-deleted files (e.g. 30 days)
  private readonly RETENTION_DAYS = 30;

  constructor(
    @InjectRepository(FileRecordEntity)
    private readonly fileRecordRepo: Repository<FileRecordEntity>,
    @Inject('IStorageProvider')
    private readonly storageProvider: IStorageProvider,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupDeletedFiles() {
    this.logger.log('Running garbage collection for deleted files...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    const expiredFiles = await this.fileRecordRepo.find({
      where: {
        isDeleted: true,
        updatedAt: LessThan(cutoffDate),
      }
    });

    if (expiredFiles.length === 0) {
      this.logger.log('No expired files found for deletion.');
      return;
    }

    let deletedCount = 0;
    for (const file of expiredFiles) {
      try {
        await this.storageProvider.delete(file.storagePath);
        await this.fileRecordRepo.remove(file);
        deletedCount++;
      } catch (error) {
        this.logger.error(`Failed to physically delete file ${file.id}: ${error.message}`);
      }
    }

    this.logger.log(`Garbage collection complete. Hard deleted ${deletedCount} files.`);
  }
}
