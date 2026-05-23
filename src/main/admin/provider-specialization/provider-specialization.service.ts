

import { Injectable, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSpecializationDto, UpdateSpecializationDto } from './dto/create-specialization.dto';
import { RedisService } from '../../../common/redis/redis.service';


@Injectable()
export class ProviderSpecializationService {
  private readonly CACHE_TTL = 300; 
  private readonly LIST_CACHE_PREFIX = 'specializations:list:';
  private readonly SINGLE_CACHE_PREFIX = 'specialization:id:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async clearListCaches() {
    const client = this.redis.getClient();
    const keys = await client.keys(`${this.LIST_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  async createSpecialization(dto: CreateSpecializationDto) {
    try {
      const existing = await this.prisma.specialization.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('Specialization with this name already exists');
      }

      const newSpecialization = await this.prisma.specialization.create({
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      await this.clearListCaches();

      return newSpecialization;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to build unique specialization matrix profile entry');
    }
  }

  async getAllSpecializations(page: number = 1, limit: number = 10) {
    try {
      const cacheKey = `${this.LIST_CACHE_PREFIX}page_${page}_limit_${limit}`;
      const cachedData = await this.redis.get<any>(cacheKey);
      if (cachedData) return cachedData;

      const skip = (page - 1) * limit;
      const [data, total] = await this.prisma.$transaction([
        this.prisma.specialization.findMany({
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        this.prisma.specialization.count(),
      ]);

      const response = {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      await this.redis.set(cacheKey, response, this.CACHE_TTL);
      return response;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch specializations list structural metrics');
    }
  }

  async getSpecializationById(id: string) {
    try {
      const cacheKey = `${this.SINGLE_CACHE_PREFIX}${id}`;
      const cachedData = await this.redis.get<any>(cacheKey);
      if (cachedData) return cachedData;

      const specialization = await this.prisma.specialization.findUnique({
        where: { id },
      });
      if (!specialization) {
        throw new NotFoundException(`Specialization matching identity data entry for ID ${id} was not located`);
      }

      await this.redis.set(cacheKey, specialization, this.CACHE_TTL);
      return specialization;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to recover specialization entity properties details');
    }
  }

  async updateSpecialization(id: string, dto: UpdateSpecializationDto) {
    try {
      const existing = await this.prisma.specialization.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(`Specialization containing reference metadata for ID ${id} not found`);
      }

      if (dto.name && dto.name !== existing.name) {
        const nameConflict = await this.prisma.specialization.findUnique({
          where: { name: dto.name },
        });
        if (nameConflict) {
          throw new ConflictException('Specialization with this name alternative match option already exists');
        }
      }

      const updatedSpecialization = await this.prisma.specialization.update({
        where: { id },
        data: dto,
      });

      await this.redis.del(`${this.SINGLE_CACHE_PREFIX}${id}`);
      await this.clearListCaches();

      return updatedSpecialization;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to execute parameters values modifications on specialization logs');
    }
  }

  async deleteSpecialization(id: string) {
    try {
      const existing = await this.prisma.specialization.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(`Specialization reference metrics matching ID ${id} not found inside cluster logs`);
      }

      await this.prisma.specialization.delete({
        where: { id },
      });

      await this.redis.del(`${this.SINGLE_CACHE_PREFIX}${id}`);
      await this.clearListCaches();

      return { message: 'Specialization entry successfully eliminated from storage repository database mapping logs' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to perform destructive structural removal sequence on specialization reference target');
    }
  }
}
