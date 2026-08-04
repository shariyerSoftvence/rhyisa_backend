import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetProviderAvailabilityDto } from './dto/client-provider-query.dto';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ClientProviderDirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAllProviders() {
    try {
      const cacheKey = 'directory:providers:all';
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const providers = await this.prisma.providerProfile.findMany({
        where: { status: 'ACCEPTED' },
        select: {
          id: true,
          location: true,
          description: true,
          profileImage: true,
          specialization: true,
          reviews: {
            select: {
              rating: true,
            },
          },
        },
      });

      const result = providers.map((provider) => {
        const totalReviews = provider.reviews.length;

        const averageRating =
          totalReviews > 0
            ? parseFloat(
                (
                  provider.reviews.reduce((acc, curr) => acc + curr.rating, 0) /
                  totalReviews
                ).toFixed(1),
              )
            : 0.0;

        const { reviews, ...providerData } = provider;

        return {
          ...providerData,
          totalReviews,
          averageRating,
        };
      });

      await this.redis.set(cacheKey, result, 300);
      return result;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to retrieve provider records collection: ${error.message}`,
      );
    }
  }

  async getProviderById(providerId: string) {
    try {
      const cacheKey = `directory:provider:${providerId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: providerId },
        include: {
          profileImage: true,
          specialization: true,
          reviews: true,
        },
      });
      if (!provider) {
        throw new NotFoundException(
          'Requested professional provider profile matching parameters missing',
        );
      }

      await this.redis.set(cacheKey, provider, 300);
      return provider;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to search provider configuration context: ${error.message}`,
      );
    }
  }

  async getAllServicesByProvider(providerId: string) {
    try {
      const cacheKey = `directory:provider:${providerId}:services`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: providerId },
      });
      if (!provider) {
        throw new NotFoundException(
          'Target provider record registry entry not verified',
        );
      }

      const services = await this.prisma.service.findMany({
        where: { providerProfileId: providerId },
        orderBy: { createdAt: 'desc' },
      });

      await this.redis.set(cacheKey, services, 300);
      return services;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to search assigned services catalogs profiles: ${error.message}`,
      );
    }
  }

  async getProviderAvailability(
    providerId: string,
    query: GetProviderAvailabilityDto,
  ) {
    try {
      const cacheKey = `directory:provider:${providerId}:availability:${query.serviceId}:${query.date}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const targetDate = new Date(query.date);
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

      const service = await this.prisma.service.findUnique({
        where: { id: query.serviceId },
      });
      if (!service || service.providerProfileId !== providerId) {
        throw new NotFoundException(
          'Operational service definition map context metadata matched poorly or omitted',
        );
      }

      const timetableSetting =
        await this.prisma.providerAvailability.findUnique({
          where: {
            providerProfileId_day: {
              providerProfileId: providerId,
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
        await this.redis.set(cacheKey, [], 60);
        return [];
      }

      const activeBookings = await this.prisma.booking.findMany({
        where: {
          providerId,
          bookingDate: {
            gte: new Date(`${query.date}T00:00:00.000Z`),
            lte: new Date(`${query.date}T23:59:59.999Z`),
          },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        select: {
          startTime: true,
          endTime: true,
        },
      });

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

      const shiftStartMinutes = parseTimeToMinutes(timetableSetting.fromTime);
      const shiftEndMinutes = parseTimeToMinutes(timetableSetting.toTime);
      const slotDuration = service.durationInMinutes;

      const continuousTimeSlots: string[] = [];
      let scanningPointer = shiftStartMinutes;

      while (scanningPointer + slotDuration <= shiftEndMinutes) {
        const potentialSlotStart = scanningPointer;
        const potentialSlotEnd = scanningPointer + slotDuration;

        const hasOverlapConflict = activeBookings.some((booking) => {
          const bookingStart = parseTimeToMinutes(booking.startTime);
          const bookingEnd = parseTimeToMinutes(booking.endTime);
          return (
            potentialSlotStart < bookingEnd && potentialSlotEnd > bookingStart
          );
        });

        if (!hasOverlapConflict) {
          continuousTimeSlots.push(formatMinutesToTime(potentialSlotStart));
        }

        scanningPointer += slotDuration;
      }

      await this.redis.set(cacheKey, continuousTimeSlots, 60);
      return continuousTimeSlots;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to compute open dynamic scheduler slots: ${error.message}`,
      );
    }
  }
}
