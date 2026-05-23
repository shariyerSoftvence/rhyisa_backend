import { Body, Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateMessageDto, StartChatsDto } from './dto/chats.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { chatsService } from './chats.service';

@ApiTags('chats Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatService: chatsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start or get a 1-to-1 chat' })
  async startChat(
    @Req() req: any,
    @Body() dto: StartChatsDto,
  ) {
    const userId = req.user.id;
    return this.chatService.getOrCreatePrivateChat(userId, dto.otherUserId);
  }

  @Get('my-chats')
  @ApiOperation({ summary: 'Get list of my chats' })
  async getMyChats(@Req() req: any) {
    const userId = req.user.id;
    return this.chatService.getMyChats(userId);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get messages for a chat' })
  async getMessages(
    @Req() req: any,
    @Param('chatId') chatId: string,
  ) {
    const userId = req.user.id;
    // Verification happens inside service
    return this.chatService.getMessages(chatId, userId);
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send a message via HTTP' })
  async sendMessage(
    @Req() req: any,
    @Param('chatId') chatId: string,
    @Body() dto: CreateMessageDto,
  ) {
    const userId = req.user.id;
    return this.chatService.createMessage(userId, chatId, dto);
  }

  @Get(':chatId/unread')
  @ApiOperation({ summary: 'Get unread message count for a chat' })
  async getUnreadCount(
    @Req() req: any,
    @Param('chatId') chatId: string,
  ) {
    const userId = req.user.id;
    return this.chatService.getUnreadCount(chatId, userId);
  }
}