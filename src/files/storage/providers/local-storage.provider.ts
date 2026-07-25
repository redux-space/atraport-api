import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IStorageProvider } from '../storage.interface';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const appendFile = promisify(fs.appendFile);

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly storageDir = path.join(process.cwd(), 'uploads');
  private activeUploads = new Map<string, { tempPath: string }>();

  constructor() {
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory() {
    if (!fs.existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
    }
  }

  async upload(filePath: string, data: Buffer, mimeType: string): Promise<string> {
    const fullPath = path.join(this.storageDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, data);
    return filePath;
  }

  async initializeMultipartUpload(filePath: string, mimeType: string): Promise<string> {
    const uploadId = uuidv4();
    const tempPath = path.join(this.storageDir, `temp_${uploadId}`);
    this.activeUploads.set(uploadId, { tempPath });
    // create empty file
    await writeFile(tempPath, Buffer.alloc(0));
    return uploadId;
  }

  async uploadChunk(uploadId: string, partNumber: number, data: Buffer): Promise<any> {
    const upload = this.activeUploads.get(uploadId);
    if (!upload) {
      throw new InternalServerErrorException('Upload session not found');
    }
    // For local, we just append to the file in order.
    // Real implementation would seek to correct offset based on partNumber.
    await appendFile(upload.tempPath, data);
    return { partNumber };
  }

  async completeMultipartUpload(uploadId: string, filePath: string, parts: any[]): Promise<string> {
    const upload = this.activeUploads.get(uploadId);
    if (!upload) {
      throw new InternalServerErrorException('Upload session not found');
    }
    const fullPath = path.join(this.storageDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    // Rename temp file to actual file
    fs.renameSync(upload.tempPath, fullPath);
    this.activeUploads.delete(uploadId);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.storageDir, filePath);
    if (!fs.existsSync(fullPath)) {
      throw new InternalServerErrorException('File not found in local storage');
    }
    return readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.storageDir, filePath);
    if (fs.existsSync(fullPath)) {
      await unlink(fullPath);
    }
  }

  async getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
    // Generate a temporary JWT or similar token for local signed URLs.
    // For simplicity, we just return the local api path
    // Real implementation would sign it with a secret.
    return `/api/files/download/${filePath}`;
  }
}
