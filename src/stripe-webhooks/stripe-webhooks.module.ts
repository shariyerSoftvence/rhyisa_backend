import { Module } from '@nestjs/common';
import { StripeWebhooksService } from './stripe-webhooks.service';
import { StripeWebhooksController } from './stripe-webhooks.controller';

@Module({
  providers: [StripeWebhooksService],
  controllers: [StripeWebhooksController],
})
export class StripeWebhooksModule {}
