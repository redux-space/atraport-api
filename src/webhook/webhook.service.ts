import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class WebhookService {
  private readonly secret = process.env.WEBHOOK_SECRET;
  private readonly logger = new Logger(WebhookService.name);

  async sendWebhook(
    url: string,
    data: any,
    retries = 3,
    delay = 1000,
  ): Promise<void> {
    const signature = this.generateSignature(JSON.stringify(data));
    try {
      // In a real application, you would use an HTTP client to send the webhook.
      this.logger.log(`Sending webhook to ${url} with signature ${signature}`);
      this.logger.log("Data:", data);
    } catch (error) {
      this.logger.error(
        `Failed to send webhook to ${url}. Retrying in ${delay}ms...`,
      );
      if (retries > 0) {
        setTimeout(
          () => this.sendWebhook(url, data, retries - 1, delay * 2),
          delay,
        );
      } else {
        this.logger.error(
          `Failed to send webhook to ${url} after multiple retries.`,
        );
      }
    }
  }

  validateSignature(signature: string, data: any): boolean {
    const expectedSignature = this.generateSignature(JSON.stringify(data));
    return signature === expectedSignature;
  }

  private generateSignature(data: string): string {
    return crypto.createHmac("sha256", this.secret).update(data).digest("hex");
  }
}
