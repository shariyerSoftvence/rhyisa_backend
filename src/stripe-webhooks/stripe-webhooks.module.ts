import { Module } from '@nestjs/common';
import { StripeWebhooksService } from './stripe-webhooks.service';
import { StripeWebhooksController } from './stripe-webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../main/notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule],
  providers: [StripeWebhooksService],
  controllers: [StripeWebhooksController],
})
export class StripeWebhooksModule {}
