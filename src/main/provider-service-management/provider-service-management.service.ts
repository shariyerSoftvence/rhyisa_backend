import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class ProviderServiceManagementService {
  private readonly CACHE_TTL = 300;

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

  async createProviderServices(authId: string, dto: CreateServiceDto) {
    try {
      const profile = await this.getProviderProfileOrThrow(authId);

      const created = await this.prisma.service.create({
        data: {
          name: dto.name,
          price: dto.price,
          durationInMinutes: dto.durationInMinutes,
          providerProfileId: profile.id,
        },
      });

      await this.redis.del(`services:provider:${authId}`);
      await this.redis.del(`directory:provider:${profile.id}:services`);

      return created;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to build new operational service element log',
      );
    }
  }

  async getAllProviderService(authId: string) {
    try {
      const cacheKey = `services:provider:${authId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const profile = await this.getProviderProfileOrThrow(authId);

      const services = await this.prisma.service.findMany({
        where: { providerProfileId: profile.id },
        orderBy: { createdAt: 'desc' },
      });

      await this.redis.set(cacheKey, services, this.CACHE_TTL);
      return services;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to pull system data rows matching active criteria',
      );
    }
  }

  async getProviderServiceById(authId: string, serviceId: string) {
    try {
      const cacheKey = `services:id:${serviceId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const profile = await this.getProviderProfileOrThrow(authId);

      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service || service.providerProfileId !== profile.id) {
        throw new NotFoundException(
          'Target service mapping metadata parameter context missing',
        );
      }

      await this.redis.set(cacheKey, service, this.CACHE_TTL);
      return service;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to process data block recovery routine',
      );
    }
  }

  async updateProviderServices(
    authId: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ) {
    try {
      const profile = await this.getProviderProfileOrThrow(authId);

      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service || service.providerProfileId !== profile.id) {
        throw new NotFoundException(
          'Service record not found or ownership mismatch detected',
        );
      }

      const updated = await this.prisma.service.update({
        where: { id: serviceId },
        data: dto,
      });

      await this.redis.del(`services:id:${serviceId}`);
      await this.redis.del(`services:provider:${authId}`);
      await this.redis.del(`directory:provider:${profile.id}:services`);

      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to modify properties indices variables on data layer',
      );
    }
  }

  async deleteProviderService(authId: string, serviceId: string) {
    try {
      const profile = await this.getProviderProfileOrThrow(authId);

      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
      });

      if (!service || service.providerProfileId !== profile.id) {
        throw new NotFoundException(
          'Specified portfolio entry does not exist under your credential scope',
        );
      }

      await this.prisma.service.delete({
        where: { id: serviceId },
      });

      await this.redis.del(`services:id:${serviceId}`);
      await this.redis.del(`services:provider:${authId}`);
      await this.redis.del(`directory:provider:${profile.id}:services`);

      return {
        message:
          'Operational service catalog entry removed clean from system registry data',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to execute atomic deletion routine sequence',
      );
    }
  }
}
