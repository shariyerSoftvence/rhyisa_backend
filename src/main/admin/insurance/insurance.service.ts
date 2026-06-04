import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class InsuranceService {
  //   private readonly CACHE_KEY_PREFIX = 'insurance:';
  private readonly ALL_INSURANCE_CACHE_KEY = 'insurance:all:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createInsurance(dto: CreateInsuranceDto) {
    try {
      const existing = await this.prisma.insuranceCompany.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(
          'Insurance company with this name already exists',
        );
      }

      const lastRecord = await this.prisma.insuranceCompany.findFirst({
        orderBy: { serial: 'desc' },
      });
      const nextSerial = lastRecord ? lastRecord.serial + 1 : 1;

      const result = await this.prisma.insuranceCompany.create({
        data: {
          name: dto.name,
          description: dto.description,
          externalLink: dto.externalLink,
          serial: nextSerial,
        },
      });

      await this.clearInsuranceCache();
      return result;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException(
        'Failed to create insurance company',
      );
    }
  }

  async getAllInsurance(page: number = 1, limit: number = 10) {
    try {
      const cacheKey = `${this.ALL_INSURANCE_CACHE_KEY}page_${page}_limit_${limit}`;
      const cachedData = await this.redis.get<any>(cacheKey);

      if (cachedData) {
        return cachedData;
      }

      const skip = (page - 1) * limit;
      const [data, total] = await this.prisma.$transaction([
        this.prisma.insuranceCompany.findMany({
          skip,
          take: limit,
          orderBy: { serial: 'asc' },
        }),
        this.prisma.insuranceCompany.count(),
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

      await this.redis.set(cacheKey, response, 300); // Cached for 5 minutes
      return response;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch insurance companies',
      );
    }
  }

  async updateInsurance(id: string, dto: UpdateInsuranceDto) {
    try {
      const existing = await this.prisma.insuranceCompany.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(
          `Insurance company with ID ${id} not found`,
        );
      }

      if (dto.name && dto.name !== existing.name) {
        const nameConflict = await this.prisma.insuranceCompany.findUnique({
          where: { name: dto.name },
        });
        if (nameConflict) {
          throw new ConflictException(
            'Insurance company with this name already exists',
          );
        }
      }

      const updated = await this.prisma.insuranceCompany.update({
        where: { id },
        data: dto,
      });

      await this.clearInsuranceCache();
      return updated;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      )
        throw error;
      throw new InternalServerErrorException(
        'Failed to update insurance company',
      );
    }
  }

  async deleteInsurance(id: string) {
    try {
      const existing = await this.prisma.insuranceCompany.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(
          `Insurance company with ID ${id} not found`,
        );
      }

      await this.prisma.insuranceCompany.delete({
        where: { id },
      });

      await this.clearInsuranceCache();
      return { message: 'Insurance company successfully removed' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to delete insurance company',
      );
    }
  }

  private async clearInsuranceCache() {
    try {
      //   const cachePattern = `${this.ALL_INSURANCE_CACHE_KEY}*`;
      await this.redis.del(`${this.ALL_INSURANCE_CACHE_KEY}page_1_limit_10`);
    } catch (error) {
      console.log(error);
    }
  }
}
