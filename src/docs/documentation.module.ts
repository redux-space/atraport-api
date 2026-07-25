import { Module } from '@nestjs/common';
import { DocumentationService } from './documentation.service';

@Module({
  providers: [DocumentationService],
  exports: [DocumentationService],
})
export class DocumentationModule {}
