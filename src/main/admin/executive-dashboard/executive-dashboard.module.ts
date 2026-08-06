import { Module } from '@nestjs/common';
import { ExecutiveDashboardController } from './executive-dashboard.controller';
import { ExecutiveDashboardService } from './executive-dashboard.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RedisModule } from '../../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ExecutiveDashboardController],
  providers: [ExecutiveDashboardService],
  exports: [ExecutiveDashboardService],
})
export class ExecutiveDashboardModule {}
