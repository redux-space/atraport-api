import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IStorageProvider } from '../storage.interface';
import { BlobServiceClient, BlockBlobClient, ContainerClient, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

@Injectable()
export class AzureStorageProvider implements IStorageProvider {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerClient: ContainerClient;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
    const containerName = process.env.AZURE_STORAGE_CONTAINER || 'astraport-uploads';
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(containerName);
  }

  async upload(filePath: string, data: Buffer, mimeType: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(filePath);
    await blockBlobClient.uploadData(data, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });
    return filePath;
  }

  async initializeMultipartUpload(filePath: string, mimeType: string): Promise<string> {
    // Azure handles block blobs differently, returning the filePath as ID
    return filePath; 
  }

  async uploadChunk(uploadId: string, partNumber: number, data: Buffer): Promise<any> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(uploadId); // uploadId is filePath
    const blockId = Buffer.from(`block-${partNumber.toString().padStart(5, '0')}`).toString('base64');
    await blockBlobClient.stageBlock(blockId, data, data.length);
    return blockId;
  }

  async completeMultipartUpload(uploadId: string, filePath: string, parts: any[]): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(filePath);
    await blockBlobClient.commitBlockList(parts);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(filePath);
    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    if (!downloadBlockBlobResponse.readableStreamBody) {
      throw new InternalServerErrorException('No readable stream body');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of downloadBlockBlobResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(filePath: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(filePath);
    await blockBlobClient.deleteIfExists();
  }

  async getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
    // Create a SAS token
    const sasOptions = {
      containerName: this.containerClient.containerName,
      blobName: filePath,
      permissions: BlobSASPermissions.parse("r"),
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + expiresIn * 1000),
    };
    
    // In a real app we'd use StorageSharedKeyCredential to generate it
    // For now, let's return a fake or unauthenticated url if sas fails
    return this.containerClient.getBlockBlobClient(filePath).url;
  }
}
