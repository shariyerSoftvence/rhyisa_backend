import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class ClientBookingHistoryService {
  private readonly CACHE_TTL = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getClientBookings(authId: string) {
    try {
      const cacheKey = `booking:client:${authId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!userProfile) {
        throw new NotFoundException(
          'Client identity profile records missing from registry',
        );
      }

      const bookings = await this.prisma.booking.findMany({
        where: { userId: userProfile.id },
        include: {
          service: true,
          provider: {
            select: {
              id: true,
              location: true,
              status: true,
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
        `Failed to pull client system booking matching criteria: ${error.message}`,
      );
    }
  }

  async getClientBookingById(authId: string, bookingId: string) {
    try {
      const cacheKey = `booking:id:${bookingId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

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
        include: {
          service: true,
          provider: true,
          payment: true,
        },
      });

      if (!booking || booking.userId !== userProfile.id) {
        throw new NotFoundException(
          'Target appointment data block recovery routine matched poorly or omitted',
        );
      }

      await this.redis.set(cacheKey, booking, this.CACHE_TTL);
      return booking;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to process client booking parameter retrieval: ${error.message}`,
      );
    }
  }
}
