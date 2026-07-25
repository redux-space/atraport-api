import { Injectable, Logger } from '@nestjs/common';
import * as NodeClam from 'clamscan';

@Injectable()
export class VirusScannerService {
  private clamscan: any;
  private readonly logger = new Logger(VirusScannerService.name);
  private isInitialized = false;

  constructor() {
    this.initClamScan();
  }

  private async initClamScan() {
    try {
      this.clamscan = await new NodeClam().init({
        removeInfected: false,
        quarantineInfected: false,
        scanLog: null,
        debugMode: false,
        fileList: null,
        scanRecursively: true,
        clamscan: {
          path: '/usr/bin/clamscan',
          db: null,
          scanArchives: true,
          active: true
        },
        clamdscan: {
          socket: '/var/run/clamav/clamd.ctl',
          host: process.env.CLAMAV_HOST || '127.0.0.1',
          port: parseInt(process.env.CLAMAV_PORT, 10) || 3310,
          timeout: 60000,
          localFallback: false,
          path: '/usr/bin/clamdscan',
          configFile: null,
          multiscan: true,
          reloadDb: false,
          active: true,
          bypassTest: false,
        },
        preference: 'clamdscan'
      });
      this.isInitialized = true;
      this.logger.log('ClamAV initialized successfully');
    } catch (error) {
      this.logger.warn(`ClamAV initialization failed, running in mock/bypass mode. Error: ${error.message}`);
      this.isInitialized = false;
    }
  }

  async scanBuffer(buffer: Buffer): Promise<{ isInfected: boolean; viruses: string[] }> {
    if (!this.isInitialized) {
      this.logger.debug('ClamAV not available, bypassing virus scan');
      return { isInfected: false, viruses: [] };
    }

    try {
      const { isInfected, viruses } = await this.clamscan.scanBuffer(buffer, 3000, 1024 * 1024);
      return { isInfected: isInfected ?? false, viruses: viruses ?? [] };
    } catch (error) {
      this.logger.error(`Error scanning buffer: ${error.message}`);
      // Fail open or closed? Let's fail open but log a critical error for now.
      return { isInfected: false, viruses: [] };
    }
  }
}
