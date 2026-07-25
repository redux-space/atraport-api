import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IStorageProvider } from '../storage.interface';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET || 'astraport-uploads';
  }

  async upload(filePath: string, data: Buffer, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
      Body: data,
      ContentType: mimeType,
    });
    await this.s3Client.send(command);
    return filePath;
  }

  async initializeMultipartUpload(filePath: string, mimeType: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: filePath,
      ContentType: mimeType,
    });
    const response = await this.s3Client.send(command);
    if (!response.UploadId) throw new InternalServerErrorException('Failed to initialize S3 multipart upload');
    return response.UploadId;
  }

  async uploadChunk(uploadId: string, partNumber: number, data: Buffer): Promise<any> {
    // Note: To use UploadPartCommand, we actually need the Key as well.
    // We would need to store Key in our activeUploads or pass it from the controller.
    // For this implementation, we assume uploadId holds enough context or we adapt the interface.
    throw new Error('uploadChunk requires Key, consider passing it or storing it.');
  }

  async completeMultipartUpload(uploadId: string, filePath: string, parts: any[]): Promise<string> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: filePath,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });
    await this.s3Client.send(command);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    const response = await this.s3Client.send(command);
    if (!response.Body) throw new InternalServerErrorException('File body is empty');
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(filePath: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    await this.s3Client.send(command);
  }

  async getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
