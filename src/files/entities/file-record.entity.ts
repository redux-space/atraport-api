import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { FileVersionEntity } from './file-version.entity';

@Entity('file_records')
export class FileRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column()
  storageProvider: string; // 'local', 's3', 'azure'

  @Column({ unique: true })
  storagePath: string;

  @Column({ nullable: true })
  cdnUrl?: string;

  @Column({ default: false })
  isCompressed: boolean;

  @Column({ default: false })
  isScanned: boolean;

  @Column({ default: false })
  isInfected: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @OneToMany(() => FileVersionEntity, version => version.fileRecord, { cascade: true })
  versions: FileVersionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
