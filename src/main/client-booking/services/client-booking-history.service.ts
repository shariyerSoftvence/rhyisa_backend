import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ClientBookingHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getClientBookings(authId: string) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!userProfile) {
        throw new NotFoundException(
          'Client identity profile records missing from registry',
        );
      }

      return await this.prisma.booking.findMany({
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
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to pull client system booking matching criteria: ${error.message}`,
      );
    }
  }

  async getClientBookingById(authId: string, bookingId: string) {
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

      return booking;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to process client booking parameter retrieval: ${error.message}`,
      );
    }
  }
}
