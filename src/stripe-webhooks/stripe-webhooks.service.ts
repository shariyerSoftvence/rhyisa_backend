import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InternalNotificationPublisherService } from '../main/notification/internal-notification-publisher.service';
import Stripe from 'stripe';
import { SubscriptionType } from '../../generated/prisma/enums';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class StripeWebhooksService {
  private readonly logger = new Logger(StripeWebhooksService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPublisher: InternalNotificationPublisherService,
    private readonly redis: RedisService,
  ) {
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
      this.logger.log(
        `[Stripe Webhook] Event Received: ${event.id} [${event.type}]`,
      );
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;

        default:
          this.logger.log(
            `[Stripe Webhook] Unhandled event type: ${event.type}`,
          );
      }
    } catch (error: any) {
      this.logger.error(
        `[Stripe Webhook] Error processing event ${event.id}: ${error.message}`,
      );
      throw new InternalServerErrorException('Webhook processing failed');
    }

    return { received: true };
  }

  private async handleAccountUpdated(account: any) {
    const stripeAccountId = account.id;
    const detailsSubmitted = account.details_submitted;
    const transfersEnabled = account.capabilities?.transfers === 'active';

    this.logger.log(
      `Processing account.updated for Custom/Express ID: ${stripeAccountId}`,
    );

    if (detailsSubmitted && transfersEnabled) {
      await this.prisma.providerProfile.updateMany({
        where: { stripeAccountId },
        data: { isPaymentEnabled: true },
      });
      this.logger.log(
        `Provider account ${stripeAccountId} has successfully activated operational billing.`,
      );
    } else {
      await this.prisma.providerProfile.updateMany({
        where: { stripeAccountId },
        data: { isPaymentEnabled: false },
      });
      this.logger.warn(
        `Provider account ${stripeAccountId} execution limits suspended due to incomplete onboarding credentials.`,
      );
    }
  }

  private async handleCheckoutSessionCompleted(session: any) {
    this.logger.log(
      `Processing checkout.session.completed for Session ID: ${session.id}`,
    );

    const metadata = session.metadata;
    if (!metadata) {
      this.logger.error(
        `No metadata object attached to Checkout session tracker: ${session.id}`,
      );
      return;
    }

    // Determine type from metadata parameters to switch logic cleanly
    if (metadata.type === 'SUBSCRIPTION_PURCHASE') {
      await this.handleSubscriptionPurchaseCompleted(session, metadata);
      return;
    }

    const {
      userId,
      providerId,
      serviceId,
      bookingDate,
      startTime,
      endTime,
      totalAmount,
      platformFee,
      providerEarnings,
    } = metadata;

    try {
      await this.prisma.$transaction(async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { stripeSessionId: session.id },
        });

        if (existingPayment) {
          this.logger.warn(
            `Payment transaction logs elements already parsed for session ID reference: ${session.id}`,
          );
          return;
        }

        const createdBooking = await tx.booking.create({
          data: {
            bookingDate: new Date(bookingDate),
            startTime,
            endTime,
            status: 'CONFIRMED',
            userId,
            providerId,
            serviceId,
          },
        });

        await tx.payment.create({
          data: {
            stripeSessionId: session.id,
            totalAmount: parseFloat(totalAmount),
            platformFee: parseFloat(platformFee),
            providerEarnings: parseFloat(providerEarnings),
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'SUCCESSFUL',
            bookingId: createdBooking.id,
          },
        });

        this.logger.log(
          `Booking ${createdBooking.id} and Payment metrics logged dynamically inside system registries database.`,
        );

        const provider = await tx.auth.findFirst({
          where: { id: providerId },
          select: { id: true },
        });

        const userAuth = await tx.userProfile.findUnique({
          where: { id: userId },
          select: { authId: true },
        });

        const providerAuth = await tx.providerProfile.findUnique({
          where: { id: providerId },
          select: { authId: true },
        });

        if (userAuth?.authId) {
          await this.redis.del(`booking:client:${userAuth.authId}`);
        }
        if (providerAuth?.authId) {
          await this.redis.del(`booking:provider:${providerAuth.authId}`);
        }
        const redisClient = this.redis.getClient();
        const availKeys = await redisClient.keys(
          `directory:provider:${providerId}:availability:*`,
        );
        if (availKeys.length > 0) {
          await redisClient.del(...availKeys);
        }

        if (provider) {
          await this.notificationPublisher.publishNotification({
            type: 'BOOKING_CONFIRMED',
            title: 'New Booking Received',
            message: `A new service booking has been confirmed. Booking ID: ${createdBooking.id}`,
            meta: {
              bookingId: createdBooking.id,
              userId,
              providerId,
              bookingDate,
              startTime,
              endTime,
              totalAmount,
            },
            recipientAuthIds: [provider.id],
          });
        }

        await this.notificationPublisher.publishNotification({
          type: 'BOOKING_CONFIRMED_ADMIN',
          title: 'New Service Booking',
          message: `Service booking confirmed. Booking ID: ${createdBooking.id}, Amount: $${totalAmount}`,
          meta: {
            bookingId: createdBooking.id,
            userId,
            providerId,
            bookingDate,
            startTime,
            endTime,
            totalAmount,
            platformFee,
          },
          recipientAuthIds: [],
        });
      });
    } catch (error: any) {
      this.logger.error(
        `Database atomic persistence engine transaction failed while mapping booking: ${error.message}`,
      );
      throw error;
    }
  }

  private async handleSubscriptionPurchaseCompleted(
    session: any,
    metadata: any,
  ) {
    const { userProfileId, planId } = metadata;
    this.logger.log(
      `Processing premium tier update logic for user profile target ID: ${userProfileId}`,
    );

    try {
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      await this.prisma.$transaction(async (tx) => {
        // Enforce update patterns via explicit 1-to-1 matching updates directly inside the profile model mappings
        await tx.userProfile.update({
          where: { id: userProfileId },
          data: {
            subscriptionType: SubscriptionType.PREMIUM,
            subscribed: {
              upsert: {
                create: {
                  stripeSessionId: session.id,
                  stripeInvoiceId: session.invoice
                    ? String(session.invoice)
                    : null,
                  status: 'active',
                  amountPaid: session.amount_total
                    ? session.amount_total / 100
                    : 8.99,
                  currentPeriodStart,
                  currentPeriodEnd,
                  planId: planId,
                },
                update: {
                  stripeSessionId: session.id,
                  stripeInvoiceId: session.invoice
                    ? String(session.invoice)
                    : null,
                  status: 'active',
                  amountPaid: session.amount_total
                    ? session.amount_total / 100
                    : 8.99,
                  currentPeriodStart,
                  currentPeriodEnd,
                  planId: planId,
                },
              },
            },
          },
        });
      });

      this.logger.log(
        `Subscription model linkages synchronized successfully for user profile: ${userProfileId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to handle completed purchase webhook processes safely: ${error.message}`,
      );
      throw error;
    }
  }
}
