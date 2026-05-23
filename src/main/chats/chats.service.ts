import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveChat } from '../../../generated/prisma/client';
import { HandleError } from '../../common/error/handle-error.decorator';
import { CreateMessageDto } from './dto/chats.dto';
import { RoleType } from '../../../generated/prisma/enums';

@Injectable()
export class chatsService {
  constructor(private prisma: PrismaService) {}

  private get client() {
    return this.prisma;
  }

  // Result mapping helpers
  private mapUser(user: any) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      name: user.fullName,
      profilePhoto: user.role === 'USER'
        ? user.userProfile?.profileImage?.url || null
        : user.providerProfile?.profileImage?.url || null,
    };
  }

  private mapParticipantUser(participant: any) {
    if (!participant) return null;
    return {
      ...participant,
      user: this.mapUser(participant.user),
    };
  }

  private mapMessage(message: any) {
    if (!message) return null;
    return {
      ...message,
      sender: this.mapUser(message.sender),
    };
  }

  private mapChat(chat: any) {
    if (!chat) return null;
    return {
      ...chat,
      participants: chat.participants?.map((p) => this.mapParticipantUser(p)) || [],
      messages: chat.messages?.map((m) => this.mapMessage(m)) || [],
    };
  }

  /** Find or create 1-to-1 chat */
  @HandleError('Failed to get or create chat', 'chat')
  async getOrCreatePrivateChat(
    userA: string,
    userB: string,
  ): Promise<any> {
    // 1. Verify User Roles (Only User-to-Provider or Provider-to-User, no User-to-User / Provider-to-Provider unless Admin is involved)
    const userAObj = await this.client.auth.findUnique({
      where: { id: userA },
      select: { role: true },
    });
    const userBObj = await this.client.auth.findUnique({
      where: { id: userB },
      select: { role: true },
    });

    if (!userAObj || !userBObj) {
      throw new NotFoundException('One or both users not found');
    }

    const roleA = userAObj.role;
    const roleB = userBObj.role;

    const isAllowed = 
      (roleA === RoleType.USER && roleB === RoleType.PROVIDER) ||
      (roleA === RoleType.PROVIDER && roleB === RoleType.USER) ||
      roleA === RoleType.ADMIN ||
      roleB === RoleType.ADMIN;

    if (!isAllowed) {
      throw new ForbiddenException('Chats are only allowed between a user and a provider');
    }

    const userSelect = {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isVerified: true,
      userProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
      providerProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
    };

    const existing = await this.client.liveChat.findFirst({
      where: {
        type: 'INDIVIDUAL',
        participants: {
          every: {
            userId: { in: [userA, userB] },
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: userSelect,
            },
          },
        },
      },
    });

    // Verify it's actually a 1-to-1 between these exact users
    if (existing) {
      const participantIds = existing.participants.map((p) => p.userId).sort();
      const expectedIds = [userA, userB].sort();

      if (JSON.stringify(participantIds) === JSON.stringify(expectedIds)) {
        return this.mapChat(existing);
      }
    }

    const newChat = await this.client.$transaction(async (tx) => {
      const chat = await tx.liveChat.create({
        data: {
          type: 'INDIVIDUAL',
          createdById: userA,
        },
      });

      const participants =
        userA === userB
          ? [{ chatId: chat.id, userId: userA }]
          : [
              { chatId: chat.id, userId: userA },
              { chatId: chat.id, userId: userB },
            ];

      await tx.liveChatParticipant.createMany({ data: participants });

      const result = await tx.liveChat.findUnique({
        where: { id: chat.id },
        include: {
          participants: {
            include: {
              user: {
                select: userSelect,
              },
            },
          },
        },
      });

      if (!result) {
        throw new Error('Failed to create chat');
      }

      return result;
    });

    return this.mapChat(newChat);
  }

  /** Get chat by ID with verification */
  @HandleError('Failed to get chat', 'chat')
  async getChatById(chatId: string, userId: string) {
    const userSelect = {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isVerified: true,
      userProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
      providerProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
    };

    const chat = await this.client.liveChat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: userSelect,
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: userSelect,
            },
          },
        },
      },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    // Verify user is a participant
    const isParticipant = chat.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    return this.mapChat(chat);
  }

  /**------------- Send message---------------------------- */
  @HandleError('Failed to send message', 'message')
  async createMessage(senderId: string, chatId: string, dto: CreateMessageDto) {
    // Verify sender is participant
    const chat = await this.client.liveChat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const isParticipant = chat.participants.some((p) => p.userId === senderId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    const userSelect = {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isVerified: true,
      userProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
      providerProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
    };

    const message = await this.client.liveMessage.create({
      data: {
        chatId,
        senderId,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
        mediaType: dto.mediaType,
      },
      include: {
        sender: {
          select: userSelect,
        },
        chat: {
          include: {
            participants: {
              include: {
                user: {
                  select: userSelect,
                },
              },
            },
          },
        },
      },
    });

    return {
      ...message,
      sender: this.mapUser(message.sender),
      chat: this.mapChat(message.chat),
    };
  }

  /** ----------Mark message as read------------------ */
  @HandleError('Failed to mark message as read', 'message')
  async markRead(messageId: string, userId: string) {
    const message = await this.client.liveMessage.findUnique({
      where: { id: messageId },
      include: { chat: { include: { participants: true } } },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Verify user is participant
    const isParticipant = message.chat.participants.some(
      (p) => p.userId === userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    return this.client.liveMessageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: {
        messageId,
        userId,
        liveChatId: message.chatId,
      },
      update: { readAt: new Date() },
    });
  }

  /** List my private chats with last message & unread count */
  @HandleError('Failed to get my chats', 'chat')
  async getMyChats(userId: string) {
    const userSelect = {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isVerified: true,
      userProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
      providerProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
    };

    const chats = await this.client.liveChat.findMany({
      where: {
        type: 'INDIVIDUAL',
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: {
            user: {
              select: userSelect,
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: userSelect,
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const mappedChats = chats.map((chat) => this.mapChat(chat));

    return Promise.all(
      mappedChats.map(async (chat: any) => {
        const unreadCount = await this.client.liveMessage.count({
          where: {
            chatId: chat.id,
            senderId: { not: userId },
            readBy: { none: { userId } },
          },
        });

        // Find the other user in the chat
        const otherUser =
          chat.participants.find((p) => p.userId !== userId)?.user || null;

        return {
          ...chat,
          unreadCount,
          otherUser,
          lastMessage: chat.messages[0] || null,
        };
      }),
    );
  }

  /** Get paginated messages for a chat */
  @HandleError('Failed to get messages', 'chat')
  async getMessages(chatId: string, userId: string) {
    // Verify user is a participant
    const chat = await this.client.liveChat.findUnique({
      where: { id: chatId },
      include: { participants: true },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const isParticipant = chat.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    const userSelect = {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isVerified: true,
      userProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
      providerProfile: {
        select: {
          profileImage: {
            select: {
              url: true,
            },
          },
        },
      },
    };

    const messages = await this.client.liveMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: userSelect,
        },
        readBy: {
          select: {
            userId: true,
            readAt: true,
          },
        },
      },
    });

    const mappedMessages = messages.map((m) => this.mapMessage(m));

    return {
      messages: mappedMessages,
    };
  }

  /** Get unread message count for a specific chat */
  @HandleError('Failed to get unread message count', 'chat')
  async getUnreadCount(chatId: string, userId: string) {
    const count = await this.client.liveMessage.count({
      where: {
        chatId,
        senderId: { not: userId },
        readBy: { none: { userId } },
      },
    });

    return { chatId, unreadCount: count };
  }
}