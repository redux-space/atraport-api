import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidatorService {
  
  private readonly allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  private readonly maxSizeBytes = 100 * 1024 * 1024; // 100 MB max for normal uploads

  validateFile(mimeType: string, size: number) {
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new BadRequestException(`File type ${mimeType} is not supported.`);
    }

    if (size > this.maxSizeBytes) {
      throw new BadRequestException(`File size exceeds the maximum limit of ${this.maxSizeBytes / 1024 / 1024} MB.`);
    }
  }

  validateChunkSize(size: number) {
     const maxChunkSize = 10 * 1024 * 1024; // 10 MB chunks
     if (size > maxChunkSize) {
        throw new BadRequestException(`Chunk size exceeds maximum of 10MB`);
     }
  }
}
