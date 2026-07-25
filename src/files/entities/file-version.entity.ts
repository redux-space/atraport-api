import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { FileRecordEntity } from './file-record.entity';

@Entity('file_versions')
export class FileVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fileRecordId: string;

  @ManyToOne(() => FileRecordEntity, file => file.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileRecordId' })
  fileRecord: FileRecordEntity;

  @Column()
  versionNumber: number;

  @Column()
  storagePath: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column()
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;
}
