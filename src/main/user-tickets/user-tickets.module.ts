import { Module } from '@nestjs/common';
import { UserTicketsController } from './user-tickets.controller';
import { UserTicketsService } from './user-tickets.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { TicketManagementModule } from '../admin/ticket-management/ticket-management.module';

@Module({
  imports: [PrismaModule, RedisModule, TicketManagementModule],
  controllers: [UserTicketsController],
  providers: [UserTicketsService],
  exports: [UserTicketsService],
})
export class UserTicketsModule {}
