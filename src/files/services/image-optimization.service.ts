import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  async optimizeImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; isCompressed: boolean }> {
    if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
      return { buffer, isCompressed: false };
    }

    try {
      // Basic optimization: converting to webp (or optimizing existing jpeg/png)
      // For simplicity, we just compress using Sharp's intelligent compression.
      let optimizer = sharp(buffer);
      
      const metadata = await optimizer.metadata();
      
      // If image is huge, we can resize it down
      if (metadata.width && metadata.width > 3840) {
        optimizer = optimizer.resize({ width: 3840, withoutEnlargement: true });
      }

      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        optimizer = optimizer.jpeg({ quality: 80, progressive: true });
      } else if (mimeType === 'image/png') {
        optimizer = optimizer.png({ quality: 80, compressionLevel: 8 });
      } else if (mimeType === 'image/webp') {
        optimizer = optimizer.webp({ quality: 80 });
      }

      const optimizedBuffer = await optimizer.toBuffer();
      
      // Only return the optimized version if it's actually smaller
      if (optimizedBuffer.length < buffer.length) {
        return { buffer: optimizedBuffer, isCompressed: true };
      }
      return { buffer, isCompressed: false };

    } catch (error) {
      this.logger.error(`Failed to optimize image: ${error.message}`);
      // Fallback to original buffer if optimization fails
      return { buffer, isCompressed: false };
    }
  }
}
