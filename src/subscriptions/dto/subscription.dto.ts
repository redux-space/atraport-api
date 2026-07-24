import { DeliveryMode, EventFilterDto } from './event-filter.dto';

/**
 * Full subscription representation returned from list/get endpoints.
 */
export class SubscriptionDto {
  id: string;
  userId: string;
  name: string;
  filter: EventFilterDto;
  deliveryMode: DeliveryMode;
  batchIntervalSeconds: number;
  callbackUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
