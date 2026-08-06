import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { SocketAuthMiddleware } from '../../../common/middleware/socket.auth.middleware';
import { RedisService } from '../../../common/redis/redis.service';
import { WEBSOCKET_CORS_CONFIG } from '../../../common/constants/cors.constants';
import Redis from 'ioredis';

export enum TicketSocketEvents {
  JOIN_TICKET = 'join_ticket',
  LEAVE_TICKET = 'leave_ticket',
  SEND_TICKET_MESSAGE = 'send_ticket_message',
  TICKET_MESSAGE_RECEIVED = 'ticket_message_received',
  TICKET_STATUS_CHANGED = 'ticket_status_changed',
  TICKET_TYPING = 'ticket_typing',
}

@Injectable()
@WebSocketGateway({
  cors: WEBSOCKET_CORS_CONFIG,
  namespace: '/tickets',
})
export class TicketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TicketGateway.name);
  private subRedisClient!: Redis;

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
    private readonly redisService: RedisService,
  ) {}

  afterInit(server: Server) {
    server.use(this.socketAuthMiddleware.use());
    this.logger.log('Socket.IO server initialized for Ticket Management Gateway');
    this.setupRedisPubSub();
  }

  private setupRedisPubSub() {
    try {
      const redisClient = this.redisService.getClient();
      this.subRedisClient = redisClient.duplicate();

      this.subRedisClient.subscribe('ticket_pubsub_events', (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to ticket_pubsub_events channel', err);
        } else {
          this.logger.log('Successfully subscribed to Redis ticket_pubsub_events channel');
        }
      });

      this.subRedisClient.on('message', (channel, message) => {
        if (channel === 'ticket_pubsub_events') {
          try {
            const parsed = JSON.parse(message);
            const { event, ticketId, payload } = parsed;
            if (event && ticketId) {
              this.server.to(`ticket:${ticketId}`).emit(event, payload);
            }
          } catch (e: any) {
            this.logger.error(`Error parsing Redis PubSub message: ${e.message}`);
          }
        }
      });
    } catch (error: any) {
      this.logger.error(`Failed setting up Redis Pub/Sub: ${error.message}`);
    }
  }

  async handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user || !user.id) {
      client.disconnect(true);
      return;
    }
    const userId = user.id;
    await client.join(`user:${userId}`);
    if (user.role === 'ADMIN') {
      await client.join('admin_room');
    }
    this.logger.log(`User connected to Ticket Socket: ${userId} (${user.role})`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      this.logger.log(`User disconnected from Ticket Socket: ${userId}`);
    }
  }

  @SubscribeMessage(TicketSocketEvents.JOIN_TICKET)
  async handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string },
  ) {
    if (data?.ticketId) {
      await client.join(`ticket:${data.ticketId}`);
      this.logger.log(`Client ${client.id} joined ticket room: ticket:${data.ticketId}`);
      return { status: 'joined', ticketId: data.ticketId };
    }
  }

  @SubscribeMessage(TicketSocketEvents.LEAVE_TICKET)
  async handleLeaveTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string },
  ) {
    if (data?.ticketId) {
      await client.leave(`ticket:${data.ticketId}`);
      this.logger.log(`Client ${client.id} left ticket room: ticket:${data.ticketId}`);
      return { status: 'left', ticketId: data.ticketId };
    }
  }

  @SubscribeMessage(TicketSocketEvents.TICKET_TYPING)
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string; isTyping: boolean },
  ) {
    if (data?.ticketId) {
      client.to(`ticket:${data.ticketId}`).emit(TicketSocketEvents.TICKET_TYPING, {
        ticketId: data.ticketId,
        userId: client.data.user?.id,
        isTyping: data.isTyping,
      });
    }
  }

  public publishTicketEvent(event: string, ticketId: string, payload: any) {
    try {
      this.server.to(`ticket:${ticketId}`).emit(event, payload);
      this.redisService.getClient().publish(
        'ticket_pubsub_events',
        JSON.stringify({ event, ticketId, payload }),
      );
    } catch (error: any) {
      this.logger.error(`Error publishing ticket event: ${error.message}`);
    }
  }
}
