import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Req, Body, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './services/files.service';
import { Request } from 'express';

// Simulated auth extraction for this context
const getUserId = (req: Request) => req.headers['x-user-id'] as string || 'test-user-id';

@Controller('api/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('No file provided');
    const userId = getUserId(req);
    const result = await this.filesService.uploadFile(userId, file.originalname, file.mimetype, file.buffer);
    return { success: true, file: result };
  }

  @Post('upload/initialize')
  async initializeChunkedUpload(
    @Req() req: Request,
    @Body('originalName') originalName: string,
    @Body('mimeType') mimeType: string,
    @Body('totalSize') totalSize: number
  ) {
    const userId = getUserId(req);
    const result = await this.filesService.initializeChunkedUpload(userId, originalName, mimeType, totalSize);
    return { success: true, ...result };
  }

  @Post('upload/chunk')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(
    @UploadedFile() chunk: Express.Multer.File,
    @Req() req: Request,
    @Body('uploadId') uploadId: string,
    @Body('partNumber') partNumber: string
  ) {
    if (!chunk) throw new BadRequestException('No chunk provided');
    const userId = getUserId(req);
    const result = await this.filesService.uploadChunk(userId, uploadId, parseInt(partNumber, 10), chunk.buffer);
    return { success: true, part: result };
  }

  @Post('upload/complete')
  async completeChunkedUpload(
    @Req() req: Request,
    @Body('uploadId') uploadId: string,
    @Body('storagePath') storagePath: string,
    @Body('originalName') originalName: string,
    @Body('mimeType') mimeType: string,
    @Body('totalSize') totalSize: number,
    @Body('parts') parts: any[]
  ) {
    const userId = getUserId(req);
    const result = await this.filesService.completeChunkedUpload(userId, uploadId, storagePath, originalName, mimeType, totalSize, parts);
    return { success: true, file: result };
  }

  @Get(':id/url')
  async getSignedUrl(@Param('id') id: string, @Req() req: Request) {
    const userId = getUserId(req);
    const url = await this.filesService.getSignedUrl(userId, id);
    return { success: true, url };
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string, @Req() req: Request) {
    const userId = getUserId(req);
    await this.filesService.deleteFile(userId, id);
    return { success: true, message: 'File deleted' };
  }
}
