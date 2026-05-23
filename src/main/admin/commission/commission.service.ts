import { Injectable, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateCommissionDto } from './dto/commission.dto';
import { CommissionType } from '../../../../generated/prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminCommissionService {
  constructor(private readonly prisma: PrismaService) {}

  async createCommission(dto: UpdateCommissionDto) {
    try {
      const existing = await this.prisma.commission.findFirst();
      if (existing) {
        throw new ConflictException('Global commission configuration is already initialized. Use update instead.');
      }

      return await this.prisma.commission.create({
        data: {
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
        },
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to create global commission record');
    }
  }

  async getCommission() {
    try {
      const commission = await this.prisma.commission.findFirst();

      if (!commission) {
        return {
          commissionType: CommissionType.FLAT,
          commissionRate: 20.0,
        };
      }

      return commission;
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve global commission data');
    }
  }

  async updateCommission(dto: UpdateCommissionDto) {
    try {
      const existing = await this.prisma.commission.findFirst();

      if (!existing) {
        throw new NotFoundException('No commission configuration found to update. Create one first.');
      }

      return await this.prisma.commission.update({
        where: { id: existing.id },
        data: {
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update global commission settings');
    }
  }
}