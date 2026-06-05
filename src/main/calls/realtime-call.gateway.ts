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

    this.users.set(userId, client.id);
    this.logger.log(`User connected: ${userId}, socket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId || client.data?.user?.id;
    if (userId) {
      this.users.delete(userId);
      this.logger.log(`User disconnected: ${userId}`);
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
    const hostSocket = this.users.get(data.hostUserId);
    const receiverSocket = this.users.get(data.recipientUserId);

    if (hostSocket) {
      this.server.to(hostSocket).emit('call-started', {
        callId: call.id,
        to: data.recipientUserId,
        title: data.title,
      });
    }

    if (receiverSocket) {
      await this.callService.markRinging(call.id);
      this.server.to(receiverSocket).emit('incoming-call', {
        callId: call.id,
        from: data.hostUserId,
        title: data.title,
      });
    } else {
      await this.callService.markMissed(call.id);
    }

    return call;
  }

  @SubscribeMessage('accept-call')
  async acceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId: string; callerId: string },
  ) {
    await this.callService.markActive(data.callId);

    const callerSocket = this.users.get(data.callerId);

    if (callerSocket) {
      this.server.to(callerSocket).emit('call-active', {
        callId: data.callId,
      });
    }
  }

  @SubscribeMessage('decline-call')
  async declineCall(@MessageBody() data: { callId: string }) {
    await this.callService.markDeclined(data.callId);
    this.server.emit('call-declined', { callId: data.callId });
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

    const callerSocket = this.users.get(data.callerId);
    const receiverSocket = this.users.get(data.receiverId);

    if (callerSocket) {
      this.server.to(callerSocket).emit('call-ended', { callId: data.callId });
    }

    if (receiverSocket) {
      this.server
        .to(receiverSocket)
        .emit('call-ended', { callId: data.callId });
    }
  }

  //  WebRTC Signaling

  @SubscribeMessage('webrtc-offer')
  handleOffer(
    @MessageBody() data: { roomId: string; offer: any; receiverId: string },
  ) {
    const receiverSocket = this.users.get(data.receiverId);
    if (receiverSocket) {
      this.server.to(receiverSocket).emit('webrtc-offer', {
        roomId: data.roomId,
        offer: data.offer,
      });
    }
  }

  @SubscribeMessage('webrtc-answer')
  handleAnswer(
    @MessageBody() data: { roomId: string; answer: any; callerId: string },
  ) {
    const callerSocket = this.users.get(data.callerId);
    if (callerSocket) {
      this.server.to(callerSocket).emit('webrtc-answer', {
        roomId: data.roomId,
        answer: data.answer,
      });
    }
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
    const targetSocket = this.users.get(data.targetUserId);
    if (targetSocket) {
      this.server.to(targetSocket).emit('ice-candidate', {
        roomId: data.roomId,
        candidate: data.candidate,
      });
    }
  }
}
