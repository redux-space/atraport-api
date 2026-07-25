import { ApiProperty } from '@nestjs/swagger';

export class JobResponseDto {
  @ApiProperty({ description: 'Job ID' })
  id: string;

  @ApiProperty({ description: 'Job type' })
  type: string;

  @ApiProperty({ description: 'Job status' })
  status: string;

  @ApiProperty({ description: 'Job result' })
  result?: any;

  @ApiProperty({ description: 'Job error' })
  error?: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTime?: number;
}
