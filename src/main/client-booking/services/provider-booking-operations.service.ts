import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateBookingStatusDto } from '../dto/booking-status-update.dto';

@Injectable()
export class ProviderBookingOperationsService {
  constructor(private readonly prisma: PrismaService) {}

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
      const profile = await this.getProviderProfileOrThrow(authId);

      return await this.prisma.booking.findMany({
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
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to search assigned system entries records: ${error.message}`,
      );
    }
  }

  async getProviderBookingById(authId: string, bookingId: string) {
    try {
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

      return await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: dto.status },
      });
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
