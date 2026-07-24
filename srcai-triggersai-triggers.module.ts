
import { Module } from '@nestjs/common';
import { AITriggerController } from './ai-triggers.controller';

@Module({
  controllers: [AITriggerController],
})
export class AITriggersModule {}

