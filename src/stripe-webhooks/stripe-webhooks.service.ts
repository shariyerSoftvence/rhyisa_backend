import { Injectable, BadRequestException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhooksService {
  private readonly logger = new Logger(StripeWebhooksService.name);
  private readonly stripe: any;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  async handleWebhook(signature: string, payload: Buffer) {
    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
      this.logger.log(`[Stripe Webhook] Event Received: ${event.id} [${event.type}]`);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object as any);
          break;

        default:
          this.logger.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      this.logger.error(`[Stripe Webhook] Error processing event ${event.id}: ${error.message}`);
      throw new InternalServerErrorException('Webhook processing failed');
    }

    return { received: true };
  }

  private async handleAccountUpdated(account: any) {
    const stripeAccountId = account.id;
    const detailsSubmitted = account.details_submitted;
    const transfersEnabled = account.capabilities?.transfers === 'active';

    this.logger.log(`Processing account.updated for Custom/Express ID: ${stripeAccountId}`);

    if (detailsSubmitted && transfersEnabled) {
      await this.prisma.providerProfile.updateMany({
        where: { stripeAccountId },
        data: { isPaymentEnabled: true },
      });
      this.logger.log(`Provider account ${stripeAccountId} has successfully activated operational billing.`);
    } else {
      await this.prisma.providerProfile.updateMany({
        where: { stripeAccountId },
        data: { isPaymentEnabled: false },
      });
      this.logger.warn(`Provider account ${stripeAccountId} execution limits suspended due to incomplete onboarding credentials.`);
    }
  }
}