import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateBookingStatusDto } from '../dto/booking-status-update.dto';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class ProviderBookingOperationsService {
  private readonly CACHE_TTL = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async getProviderProfileOrThrow(authId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { authId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Provider profile not initialized for this account',
      );
    }
    return profile;
  }

  async getProviderBookings(authId: string) {
    try {
      const cacheKey = `booking:provider:${authId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const profile = await this.getProviderProfileOrThrow(authId);

      const bookings = await this.prisma.booking.findMany({
        where: { providerId: profile.id },
        include: {
          service: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
          payment: true,
        },
        orderBy: { bookingDate: 'desc' },
      });

      await this.redis.set(cacheKey, bookings, this.CACHE_TTL);
      return bookings;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to search assigned system entries records: ${error.message}`,
      );
    }
  }

  async getProviderBookingById(authId: string, bookingId: string) {
    try {
      const cacheKey = `booking:id:${bookingId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const profile = await this.getProviderProfileOrThrow(authId);

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          service: true,
          user: true,
          payment: true,
        },
      });

      if (!booking || booking.providerId !== profile.id) {
        throw new NotFoundException(
          'Specified folio entry does not exist under your credential scope',
        );
      }

      await this.redis.set(cacheKey, booking, this.CACHE_TTL);
      return booking;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to recover targeted block metadata schema: ${error.message}`,
      );
    }
  }

  async updateBookingStatus(
    authId: string,
    bookingId: string,
    dto: UpdateBookingStatusDto,
  ) {
    try {
      const profile = await this.getProviderProfileOrThrow(authId);

      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: { select: { authId: true } } },
      });

      if (!booking || booking.providerId !== profile.id) {
        throw new NotFoundException(
          'Specified folio entry does not exist under your credential scope',
        );
      }

      if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
        throw new BadRequestException(
          'Target allocation sequence already reached final execution status block',
        );
      }

      const updated = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: dto.status },
      });

      await this.redis.del(`booking:id:${bookingId}`);
      await this.redis.del(`booking:provider:${authId}`);
      if (booking.user?.authId) {
        await this.redis.del(`booking:client:${booking.user.authId}`);
      }

      return updated;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to modify properties indices updates variables on system layer: ${error.message}`,
      );
    }
  }
}
