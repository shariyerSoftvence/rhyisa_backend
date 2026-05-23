import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatsController } from './chats.controller';
import { chatsService } from './chats.service';
import { SocketAuthMiddleware } from '../../common/middleware/socket.auth.middleware';
import { ChatsGateway } from './chats.gateway';
import { ActiveUsersService } from './active-user.service';

@Module({
  imports: [AuthModule],
  controllers: [ChatsController],
  providers: [
    chatsService,
    ChatsGateway,
    ActiveUsersService,
    SocketAuthMiddleware,
  ],
  exports: [chatsService],
})
export class PrivateMessageModule {}