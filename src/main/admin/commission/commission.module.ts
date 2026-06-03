import { Module } from '@nestjs/common';
import { AdminCommissionService } from './commission.service';
import { AdminCommissionController } from './commission.controller';

@Module({
  providers: [AdminCommissionService],
  controllers: [AdminCommissionController],
})
export class CommissionModule {}
