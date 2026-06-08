import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SocketAuthMiddleware } from '../../common/middleware/socket.auth.middleware';
import { WEBSOCKET_CORS_CONFIG } from '../../common/constants/cors.constants';
import { RoleType } from '../../../generated/prisma/enums';

export const NotificationEvents = {
  NOTIFICATION_RECEIVED: 'notification_received',
};

@WebSocketGateway({
  cors: WEBSOCKET_CORS_CONFIG,
  namespace: '/notification',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly socketAuthMiddleware: SocketAuthMiddleware) {}

  afterInit(server: Server) {
    server.use(this.socketAuthMiddleware.use());
    this.logger.log('Socket.IO server initialized for Realtime Notifications');
  }

  async handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user || !user.id) {
      client.disconnect(true);
      return;
    }

    const userId = user.id;
    await client.join(`user:${userId}`);

    // Automatically place administrator accounts inside an explicit room grouping
    if (user.role === RoleType.ADMIN) {
      await client.join('role:ADMIN');
      this.logger.log(
        `Admin user connected to global notifications: ${userId}`,
      );
    } else {
      this.logger.log(
        `User connected to notifications: ${userId} (${user.role})`,
      );
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      this.logger.log(`User disconnected from notifications: ${userId}`);
    }
  }

  sendNotificationToUser(userId: string, payload: any) {
    this.server
      .to(`user:${userId}`)
      .emit(NotificationEvents.NOTIFICATION_RECEIVED, payload);
  }

  sendNotificationToAdmins(payload: any) {
    this.server
      .to('role:ADMIN')
      .emit(NotificationEvents.NOTIFICATION_RECEIVED, payload);
  }
}
