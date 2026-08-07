import { Module } from '@nestjs/common';
import { TicketManagementController } from './ticket-management.controller';
import { TicketManagementService } from './ticket-management.service';
import { TicketGateway } from './ticket.gateway';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RedisModule } from '../../../common/redis/redis.module';
import { ExecutiveDashboardModule } from '../executive-dashboard/executive-dashboard.module';
import { SocketAuthMiddleware } from '../../../common/middleware/socket.auth.middleware';

@Module({
  imports: [PrismaModule, RedisModule, ExecutiveDashboardModule],
  controllers: [TicketManagementController],
  providers: [TicketManagementService, TicketGateway, SocketAuthMiddleware],
  exports: [TicketManagementService, TicketGateway],
})
export class TicketManagementModule {}
