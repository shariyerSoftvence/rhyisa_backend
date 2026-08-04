import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UpdateCommissionDto } from './dto/commission.dto';
import { CommissionType } from '../../../../generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class AdminCommissionService {
  private readonly CACHE_KEY = 'commission:global';
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createCommission(dto: UpdateCommissionDto) {
    try {
      const existing = await this.prisma.commission.findFirst();
      if (existing) {
        throw new ConflictException(
          'Global commission configuration is already initialized. Use update instead.',
        );
      }

      const result = await this.prisma.commission.create({
        data: {
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
        },
      });

      await this.redis.del(this.CACHE_KEY);
      return result;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException(
        'Failed to create global commission record',
      );
    }
  }

  async getCommission() {
    try {
      const cached = await this.redis.get<any>(this.CACHE_KEY);
      if (cached) return cached;

      const commission = await this.prisma.commission.findFirst();

      const result = commission || {
        commissionType: CommissionType.FLAT,
        commissionRate: 20.0,
      };

      await this.redis.set(this.CACHE_KEY, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve global commission data',
      );
    }
  }

  async updateCommission(dto: UpdateCommissionDto) {
    try {
      const existing = await this.prisma.commission.findFirst();

      if (!existing) {
        throw new NotFoundException(
          'No commission configuration found to update. Create one first.',
        );
      }

      const updated = await this.prisma.commission.update({
        where: { id: existing.id },
        data: {
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
        },
      });

      await this.redis.del(this.CACHE_KEY);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to update global commission settings',
      );
    }
  }
}
