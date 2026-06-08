import { Module } from '@nestjs/common';
import { InternalNotificationPublisherService } from './internal-notification-publisher.service';
import { NotificationsGateway } from './notifications.gateway';
import { SocketAuthMiddleware } from '../../common/middleware/socket.auth.middleware';
import { UserNotificationsHubController } from './user-notifications-hub/user-notifications-hub.controller';
import { UserNotificationsHubService } from './user-notifications-hub/user-notifications-hub.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    InternalNotificationPublisherService,
    NotificationsGateway,
    SocketAuthMiddleware,
    UserNotificationsHubService,
  ],
  exports: [InternalNotificationPublisherService],
  controllers: [UserNotificationsHubController],
})
export class NotificationModule {}
