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
import { Logger } from '@nestjs/common';
import { SocketAuthMiddleware } from '../../common/middleware/socket.auth.middleware';
import { chatsService } from './chats.service';
import { ActiveUsersService } from './active-user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatEvents, CreateMessageDto } from './dto/chats.dto';
import { WEBSOCKET_CORS_CONFIG } from '../../common/constants/cors.constants';

@WebSocketGateway({
  cors: WEBSOCKET_CORS_CONFIG,
  namespace: '/chat',
})
export class ChatsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: chatsService,
    private readonly activeUsersService: ActiveUsersService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use(this.socketAuthMiddleware.use());
    this.logger.log('Socket.IO server initialized for Private Messaging');
  }

  async handleConnection(client: Socket) {
    const user = client.data.user;
    if (!user || !user.id) {
      client.disconnect(true);
      return;
    }

    const userId = user.id;
    await client.join(`user:${userId}`);
    await this.activeUsersService.setUserOnline(userId, client.id);

    this.logger.log(
      `User connected to chat: ${userId} (${user.email}), socket: ${client.id}`,
    );

    // Broadcast user status change
    this.server.emit(ChatEvents.USER_STATUS_CHANGED, {
      userId,
      status: 'online',
      timestamp: new Date(),
    });

    // Send conversation list on connect
    const conversations = await this.chatService.getMyChats(userId);
    client.emit(ChatEvents.CONVERSATION_LIST, conversations);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      await this.activeUsersService.setUserOffline(userId);
      this.logger.log(`User disconnected from chat: ${userId}`);

      this.server.emit(ChatEvents.USER_STATUS_CHANGED, {
        userId,
        status: 'offline',
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage(ChatEvents.SEND_MESSAGE)
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string } & CreateMessageDto,
  ) {
    const user = client.data.user;
    const { receiverId } = data;

    // Find or create a chat between sender and receiver
    const chat = await this.chatService.getOrCreatePrivateChat(
      user.id,
      receiverId,
    );

    // Create the message
    const message = await this.chatService.createMessage(
      user.id,
      chat.id,
      data,
    );

    // Build payload
    const payload = {
      id: message.id,
      chatId: message.chatId,
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      sender: message.sender,
      receiver:
        message.chat.participants
          .map((p) => p.user)
          .find((u) => u.id !== message.senderId) ?? null,
      createdAt: message.createdAt,
    };

    // Emit message to both users (sender & receiver) via their respective rooms
    this.server
      .to(`user:${receiverId}`)
      .emit(ChatEvents.RECEIVE_MESSAGE, payload);
    this.server.to(`user:${user.id}`).emit(ChatEvents.MESSAGE_SENT, payload);
  }

  @SubscribeMessage(ChatEvents.MESSAGE_READ)
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId }: { messageId: string },
  ) {
    const user = client.data.user;
    await this.chatService.markRead(messageId, user.id);

    const msg = await this.prisma.liveMessage.findUnique({
      where: { id: messageId },
      select: { chatId: true, senderId: true },
    });

    if (msg && msg.senderId !== user.id) {
      this.server.to(`user:${msg.senderId}`).emit(ChatEvents.MESSAGE_READ, {
        messageId,
        readBy: user.id,
        chatId: msg.chatId,
      });
    }
  }

  @SubscribeMessage(ChatEvents.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { chatId, receiverId }: { chatId: string; receiverId: string },
  ) {
    const user = client.data.user;
    await this.activeUsersService.setUserTyping(chatId, user.id);

    // Notify receiver
    this.server.to(`user:${receiverId}`).emit(ChatEvents.TYPING_START, {
      userId: user.id,
      chatId,
    });
  }

  @SubscribeMessage(ChatEvents.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    { chatId, receiverId }: { chatId: string; receiverId: string },
  ) {
    const user = client.data.user;
    await this.activeUsersService.removeUserTyping(chatId, user.id);

    // Notify receiver
    this.server.to(`user:${receiverId}`).emit(ChatEvents.TYPING_STOP, {
      userId: user.id,
      chatId,
    });
  }

  @SubscribeMessage(ChatEvents.GET_USER_STATUS)
  async handleGetUserStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() { userId }: { userId: string },
  ) {
    const presence = await this.activeUsersService.getUserPresence(userId);

    client.emit(ChatEvents.USER_STATUS, {
      userId,
      status: presence?.status || 'offline',
      lastSeen: presence?.lastSeen || null,
    });
  }

  @SubscribeMessage(ChatEvents.SET_USER_STATUS)
  async handleSetStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() { status }: { status: 'online' | 'away' | 'offline' },
  ) {
    const user = client.data.user;
    await this.activeUsersService.setUserStatus(user.id, status);

    // Broadcast status change
    this.server.emit(ChatEvents.USER_STATUS_CHANGED, {
      userId: user.id,
      status,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage(ChatEvents.LOAD_CONVERSATIONS)
  async handleLoadConversations(@ConnectedSocket() client: Socket) {
    const user = client.data.user;
    const conversations = await this.chatService.getMyChats(user.id);
    client.emit(ChatEvents.CONVERSATION_LIST, conversations);
  }

  @SubscribeMessage(ChatEvents.LOAD_SINGLE_CONVERSATION)
  async handleLoadSingleConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() { chatId }: { chatId: string },
  ) {
    const user = client.data.user;
    // Verify access by getting the chat
    await this.chatService.getChatById(chatId, user.id);
    const { messages } = await this.chatService.getMessages(chatId, user.id);

    client.emit(ChatEvents.CONVERSATION_MESSAGES, {
      chatId,
      messages,
    });
  }
}
