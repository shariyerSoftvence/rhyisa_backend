import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetProviderAvailabilityDto } from './dto/client-provider-query.dto';

@Injectable()
export class ClientProviderDirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllProviders() {
    try {
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

      return providers.map((provider) => {
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
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to retrieve provider records collection: ${error.message}`,
      );
    }
  }

  async getProviderById(providerId: string) {
    try {
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
      const provider = await this.prisma.providerProfile.findUnique({
        where: { id: providerId },
      });
      if (!provider) {
        throw new NotFoundException(
          'Target provider record registry entry not verified',
        );
      }

      return await this.prisma.service.findMany({
        where: { providerProfileId: providerId },
        orderBy: { createdAt: 'desc' },
      });
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

      return continuousTimeSlots;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to compute open dynamic scheduler slots: ${error.message}`,
      );
    }
  }
}
