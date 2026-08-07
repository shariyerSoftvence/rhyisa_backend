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
import { RealTimeCallService } from './realtime-call.service';
import { Logger } from '@nestjs/common';
import { WEBSOCKET_CORS_CONFIG } from '../../common/constants/cors.constants';
import { SocketAuthMiddleware } from '../../common/middleware/socket.auth.middleware';

@WebSocketGateway({
  cors: WEBSOCKET_CORS_CONFIG,
  namespace: '/realtime-call',
})
export class RealTimeCallGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealTimeCallGateway.name);

  @WebSocketServer()
  server!: Server;

  private users = new Map<string, string>();

  constructor(
    private readonly callService: RealTimeCallService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
  ) {}

  afterInit(server: Server) {
    // Register JWT authentication middleware
    server.use(this.socketAuthMiddleware.use());
    this.logger.log(
      'Socket.IO server initialized for RealTime Call with JWT middleware',
    );
  }

  async handleConnection(client: Socket) {
    const userId = client.data?.userId || client.data?.user?.id;
    if (!userId) {
      this.logger.error('Unauthenticated socket reached handleConnection');
      client.disconnect(true);
      return;
    }

    await client.join(`user:${userId}`);
    this.users.set(userId, client.id);
    this.logger.log(
      `User connected to call gateway: ${userId}, socket: ${client.id}`,
    );
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId || client.data?.user?.id;
    if (userId) {
      this.users.delete(userId);
      this.logger.log(`User disconnected from call gateway: ${userId}`);
    }
  }

  @SubscribeMessage('start-call')
  async startCall(
    @MessageBody()
    data: {
      hostUserId: string;
      recipientUserId: string;
      title?: string;
    },
  ) {
    const call = await this.callService.createCall(
      data.hostUserId,
      data.recipientUserId,
      data.title,
    );

    // Emit to host room
    this.server.to(`user:${data.hostUserId}`).emit('call-started', {
      callId: call.id,
      to: data.recipientUserId,
      title: data.title,
    });

    // Check if recipient is in room or online
    const recipientSockets = await this.server
      .in(`user:${data.recipientUserId}`)
      .fetchSockets();

    if (recipientSockets.length > 0) {
      await this.callService.markRinging(call.id);
      this.server.to(`user:${data.recipientUserId}`).emit('incoming-call', {
        callId: call.id,
        from: data.hostUserId,
        title: data.title,
      });
    } else {
      await this.callService.markMissed(call.id);
      this.server.to(`user:${data.hostUserId}`).emit('call-missed', {
        callId: call.id,
        recipientUserId: data.recipientUserId,
      });
    }

    return call;
  }

  @SubscribeMessage('accept-call')
  async acceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; callerId: string },
  ) {
    await this.callService.markActive(data.callId);
    this.server.to(`user:${data.callerId}`).emit('call-active', {
      callId: data.callId,
    });
  }

  @SubscribeMessage('decline-call')
  async declineCall(
    @MessageBody() data: { callId: string; callerId?: string },
  ) {
    await this.callService.markDeclined(data.callId);
    if (data.callerId) {
      this.server
        .to(`user:${data.callerId}`)
        .emit('call-declined', { callId: data.callId });
    } else {
      this.server.emit('call-declined', { callId: data.callId });
    }
  }

  @SubscribeMessage('end-call')
  async endCall(
    @MessageBody()
    data: {
      callId: string;
      callerId: string;
      receiverId: string;
    },
  ) {
    await this.callService.endCall(data.callId);

    this.server
      .to(`user:${data.callerId}`)
      .emit('call-ended', { callId: data.callId });
    this.server
      .to(`user:${data.receiverId}`)
      .emit('call-ended', { callId: data.callId });
  }

  //  WebRTC Signaling

  @SubscribeMessage('webrtc-offer')
  handleOffer(
    @MessageBody() data: { roomId: string; offer: any; receiverId: string },
  ) {
    this.server.to(`user:${data.receiverId}`).emit('webrtc-offer', {
      roomId: data.roomId,
      offer: data.offer,
    });
  }

  @SubscribeMessage('webrtc-answer')
  handleAnswer(
    @MessageBody() data: { roomId: string; answer: any; callerId: string },
  ) {
    this.server.to(`user:${data.callerId}`).emit('webrtc-answer', {
      roomId: data.roomId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody()
    data: {
      roomId: string;
      candidate: any;
      targetUserId: string;
    },
  ) {
    this.server.to(`user:${data.targetUserId}`).emit('ice-candidate', {
      roomId: data.roomId,
      candidate: data.candidate,
    });
  }
}
