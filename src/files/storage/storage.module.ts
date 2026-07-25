import { Module } from '@nestjs/common';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { AzureStorageProvider } from './providers/azure-storage.provider';

const storageProviderFactory = {
  provide: 'IStorageProvider',
  useFactory: () => {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    switch (provider) {
      case 's3':
        return new S3StorageProvider();
      case 'azure':
        return new AzureStorageProvider();
      case 'local':
      default:
        return new LocalStorageProvider();
    }
  },
};

@Module({
  providers: [storageProviderFactory],
  exports: ['IStorageProvider'],
})
export class StorageModule {}
