import { Module } from '@nestjs/common';
import { AdminProviderManagementController } from './admin-provider-management.controller';
import { AdminProviderManagementService } from './admin-provider-management.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RedisModule } from '../../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AdminProviderManagementController],
  providers: [AdminProviderManagementService],
  exports: [AdminProviderManagementService],
})
export class AdminProviderManagementModule {}
