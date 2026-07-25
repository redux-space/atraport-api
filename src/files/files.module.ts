import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { FilesController } from './files.controller';
import { FilesService } from './services/files.service';
import { VirusScannerService } from './services/virus-scanner.service';
import { ImageOptimizationService } from './services/image-optimization.service';
import { FileValidatorService } from './services/file-validator.service';
import { GarbageCollectorService } from './services/garbage-collector.service';
import { StorageModule } from './storage/storage.module';

import { FileRecordEntity } from './entities/file-record.entity';
import { FileVersionEntity } from './entities/file-version.entity';
import { StorageQuotaEntity } from './entities/storage-quota.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FileRecordEntity,
      FileVersionEntity,
      StorageQuotaEntity
    ]),
    ScheduleModule.forRoot(),
    StorageModule
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    VirusScannerService,
    ImageOptimizationService,
    FileValidatorService,
    GarbageCollectorService
  ],
  exports: [FilesService]
})
export class FilesModule {}
