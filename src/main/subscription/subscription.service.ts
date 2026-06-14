import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionService {
  private readonly stripe: any;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  async getAllAvailablePlans() {
    try {
      return await this.prisma.subscriptionPlan.findMany({
        orderBy: { price: 'asc' },
      });
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to retrieve premium tier items: ${error.message}`,
      );
    }
  }

  async createCheckoutSession(authId: string, planId: string) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });

      if (!userProfile) {
        throw new NotFoundException(
          'Target user profile properties not found.',
        );
      }

      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new NotFoundException(
          'Selected subscription product configuration missing.',
        );
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment', // use subscription mode if recurring via stripe billing, or tracking transaction locally via payment mode
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: plan.name,
                description: plan.description.join(', '),
              },
              unit_amount: Math.round(plan.price * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-canceled`,
        metadata: {
          type: 'SUBSCRIPTION_PURCHASE',
          userProfileId: userProfile.id,
          planId: plan.id,
        },
      });

      return { checkoutUrl: session.url };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(
        `Stripe gateway initiation error handling session compilation: ${error.message}`,
      );
    }
  }
}
