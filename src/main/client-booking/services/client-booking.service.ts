import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateBookingDto,
  RescheduleBookingDto,
} from '../dto/client-booking.dto';
import Stripe from 'stripe';

@Injectable()
export class ClientBookingService {
  private readonly stripe: any;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  async initiateBookingCheckout(authId: string, dto: CreateBookingDto) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!userProfile) {
        throw new NotFoundException(
          'Client identity profile records missing from registry',
        );
      }

      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: dto.providerId },
      });
      if (!provider) {
        throw new NotFoundException(
          'Selected professional provider context not located',
        );
      }
      if (!provider.isPaymentEnabled || !provider.stripeAccountId) {
        throw new BadRequestException(
          'Target provider has not active billing parameters configured or onboarding is pending',
        );
      }

      const service = await this.prisma.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service || service.providerProfileId !== dto.providerId) {
        throw new NotFoundException(
          'Target operational service entry mapping mismatch error',
        );
      }

      const targetDate = new Date(dto.bookingDate);
      const daysMap = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      const dayOfWeekName = daysMap[targetDate.getDay()];

      const timetableSetting =
        await this.prisma.providerAvailability.findUnique({
          where: {
            providerProfileId_day: {
              providerProfileId: dto.providerId,
              day: dayOfWeekName as any,
            },
          },
        });

      if (
        !timetableSetting ||
        timetableSetting.isOff ||
        !timetableSetting.fromTime ||
        !timetableSetting.toTime
      ) {
        throw new BadRequestException(
          'Provider does not accept operations on the specified calendar date',
        );
      }

      const parseTimeToMinutes = (t: string): number => {
        const [hours, minutes] = t.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const formatMinutesToTime = (m: number): string => {
        const hours = Math.floor(m / 60)
          .toString()
          .padStart(2, '0');
        const minutes = (m % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      const requestedStartMinutes = parseTimeToMinutes(dto.startTime);
      const requestedEndMinutes =
        requestedStartMinutes + service.durationInMinutes;
      const computedEndTimeStr = formatMinutesToTime(requestedEndMinutes);

      const shiftStartMinutes = parseTimeToMinutes(timetableSetting.fromTime);
      const shiftEndMinutes = parseTimeToMinutes(timetableSetting.toTime);

      if (
        requestedStartMinutes < shiftStartMinutes ||
        requestedEndMinutes > shiftEndMinutes
      ) {
        throw new BadRequestException(
          'Requested window runs outside provider calendar operational shift metrics',
        );
      }

      const conflictBooking = await this.prisma.booking.findFirst({
        where: {
          providerId: dto.providerId,
          bookingDate: {
            gte: new Date(`${dto.bookingDate}T00:00:00.000Z`),
            lte: new Date(`${dto.bookingDate}T23:59:59.999Z`),
          },
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            {
              startTime: { lte: dto.startTime },
              endTime: { gt: dto.startTime },
            },
            {
              startTime: { lt: computedEndTimeStr },
              endTime: { gte: computedEndTimeStr },
            },
            {
              startTime: { gte: dto.startTime },
              endTime: { lte: computedEndTimeStr },
            },
          ],
        },
      });

      if (conflictBooking) {
        throw new BadRequestException(
          'The selected slot timeline matches an existing allocation profile exactly',
        );
      }

      let commissionConfig = await this.prisma.commission.findFirst();
      if (!commissionConfig) {
        commissionConfig = {
          id: '',
          commissionType: 'FLAT',
          commissionRate: 20.0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const totalPrice = service.price;
      let calculatedPlatformFee = 0;

      if (commissionConfig.commissionType === 'FLAT') {
        calculatedPlatformFee = commissionConfig.commissionRate;
      } else {
        calculatedPlatformFee =
          (totalPrice * commissionConfig.commissionRate) / 100;
      }

      if (calculatedPlatformFee > totalPrice) {
        calculatedPlatformFee = totalPrice;
      }

      const providerEarnings = totalPrice - calculatedPlatformFee;

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${service.name} with Provider`,
                description: `Date: ${dto.bookingDate} | Time: ${dto.startTime} - ${computedEndTimeStr}`,
              },
              unit_amount: Math.round(totalPrice * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancelled`,
        metadata: {
          userId: userProfile.id,
          providerId: dto.providerId,
          serviceId: dto.serviceId,
          bookingDate: dto.bookingDate,
          startTime: dto.startTime,
          endTime: computedEndTimeStr,
          totalAmount: totalPrice.toString(),
          platformFee: calculatedPlatformFee.toString(),
          providerEarnings: providerEarnings.toString(),
        },
      });

      return { checkoutUrl: session.url };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to construct Stripe Checkout interface transaction logs: ${error.message}`,
      );
    }
  }

  async rescheduleBooking(
    authId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
  ) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!userProfile) {
        throw new NotFoundException(
          'Client identity profile records missing from registry',
        );
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { service: true },
      });

      if (!booking || booking.userId !== userProfile.id) {
        throw new NotFoundException(
          'Target appointment allocation record context missing or mismatched',
        );
      }

      if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
        throw new BadRequestException(
          'Only pending or globally confirmed slots can accept modifications runtime matrices',
        );
      }

      const targetDate = new Date(dto.bookingDate);
      const daysMap = [
        'SUNDAY',
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
      ];
      const dayOfWeekName = daysMap[targetDate.getDay()];

      const timetableSetting =
        await this.prisma.providerAvailability.findUnique({
          where: {
            providerProfileId_day: {
              providerProfileId: booking.providerId,
              day: dayOfWeekName as any,
            },
          },
        });

      if (
        !timetableSetting ||
        timetableSetting.isOff ||
        !timetableSetting.fromTime ||
        !timetableSetting.toTime
      ) {
        throw new BadRequestException(
          'Target professional calendar parameters configuration blocks operations on the specified date',
        );
      }

      const parseTimeToMinutes = (t: string): number => {
        const [hours, minutes] = t.split(':').map(Number);
        return hours * 60 + minutes;
      };

      const formatMinutesToTime = (m: number): string => {
        const hours = Math.floor(m / 60)
          .toString()
          .padStart(2, '0');
        const minutes = (m % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      };

      const requestedStartMinutes = parseTimeToMinutes(dto.startTime);
      const requestedEndMinutes =
        requestedStartMinutes + booking.service.durationInMinutes;
      const computedEndTimeStr = formatMinutesToTime(requestedEndMinutes);

      const shiftStartMinutes = parseTimeToMinutes(timetableSetting.fromTime);
      const shiftEndMinutes = parseTimeToMinutes(timetableSetting.toTime);

      if (
        requestedStartMinutes < shiftStartMinutes ||
        requestedEndMinutes > shiftEndMinutes
      ) {
        throw new BadRequestException(
          'Requested window runs outside provider calendar operational shift metrics',
        );
      }

      const conflictBooking = await this.prisma.booking.findFirst({
        where: {
          id: { not: bookingId },
          providerId: booking.providerId,
          bookingDate: {
            gte: new Date(`${dto.bookingDate}T00:00:00.000Z`),
            lte: new Date(`${dto.bookingDate}T23:59:59.999Z`),
          },
          status: { in: ['PENDING', 'CONFIRMED'] },
          OR: [
            {
              startTime: { lte: dto.startTime },
              endTime: { gt: dto.startTime },
            },
            {
              startTime: { lt: computedEndTimeStr },
              endTime: { gte: computedEndTimeStr },
            },
            {
              startTime: { gte: dto.startTime },
              endTime: { lte: computedEndTimeStr },
            },
          ],
        },
      });

      if (conflictBooking) {
        throw new BadRequestException(
          'The selected slot timeline matches an existing allocation profile exactly',
        );
      }

      return await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          bookingDate: new Date(dto.bookingDate),
          startTime: dto.startTime,
          endTime: computedEndTimeStr,
        },
      });
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to adjust appointment allocation matrix variables: ${error.message}`,
      );
    }
  }

  async cancelWithRefund(authId: string, bookingId: string) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!userProfile) {
        throw new NotFoundException(
          'Client identity profile records missing from registry',
        );
      }

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true },
      });

      if (!booking || booking.userId !== userProfile.id) {
        throw new NotFoundException(
          'Target booking session reference logs matched poorly or missing',
        );
      }

      if (booking.status === 'CANCELLED') {
        throw new BadRequestException(
          'The specified registration element has already processed revocation sequences',
        );
      }

      if (!booking.payment || booking.payment.status !== 'SUCCESSFUL') {
        return await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        });
      }

      const paymentIntentSession = await this.stripe.checkout.sessions.retrieve(
        booking.payment.stripeSessionId,
      );
      const originalPaymentIntentId =
        paymentIntentSession.payment_intent as string;

      if (!originalPaymentIntentId) {
        throw new BadRequestException(
          'No processing signature track matching transactional properties verified by Stripe engine',
        );
      }

      await this.stripe.refunds.create({
        payment_intent: originalPaymentIntentId,
      });

      return await this.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        });

        await tx.payment.update({
          where: { bookingId },
          data: { status: 'REFUNDED' },
        });

        return {
          message:
            'Booking successfully revoked and payment tracking records dynamically refunded via Stripe API layers',
          booking: updatedBooking,
        };
      });
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to execute automated payment reverse execution loops: ${error.message}`,
      );
    }
  }
}
