import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  TicketGateway,
  TicketSocketEvents,
} from '../admin/ticket-management/ticket.gateway';
import { CreateUserTicketDto } from './dto/create-user-ticket.dto';
import { QueryUserTicketDto } from './dto/query-user-ticket.dto';
import { CreateTicketMessageDto } from '../admin/ticket-management/dto/create-ticket-message.dto';
import {
  PreferredContactMethod,
  TicketPriority,
  TicketStatus,
} from '../../../generated/prisma/enums';
import { TicketWhereInput } from '../../../generated/prisma/models';

export interface FormattedTicketResponse {
  message: string;
  data: {
    statusCounts: {
      OPEN: number;
      IN_PROGRESS: number;
      RESOLVED: number;
      CLOSED: number;
      TOTAL: number;
    };
    pagination: {
      totalItems: number;
      currentPage: number;
      limit: number;
      totalPages: number;
    };
    tickets: Array<{
      id: string;
      ticketNumber: string;
      subject: string;
      description: string;
      category: string;
      priority: TicketPriority;
      status: TicketStatus;
      preferredContactMethod: PreferredContactMethod;
      attachments: string[];
      lastMessage: {
        id: string;
        message: string;
        createdAt: Date;
        isAgent: boolean;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  };
}

export interface SingleTicketResponse {
  message: string;
  data: {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    category: string;
    priority: TicketPriority;
    status: TicketStatus;
    preferredContactMethod: PreferredContactMethod;
    attachments: string[];
    user: {
      id: string;
      fullName: string;
      email: string;
    };
    assignedTo: {
      id: string;
      fullName: string;
      email: string;
    } | null;
    messages: Array<{
      id: string;
      message: string;
      isAgent: boolean;
      createdAt: Date;
      sender: {
        id: string;
        fullName: string;
        email: string;
        role: string;
      };
    }>;
    createdAt: Date;
    updatedAt: Date;
  };
}

@Injectable()
export class UserTicketsService {
  private readonly CACHE_TTL = 180; // 3 minutes
  private readonly SINGLE_TICKET_PREFIX = 'ticket:detail:';
  private readonly LIST_TICKETS_PREFIX = 'tickets:list:';
  private readonly USER_TICKETS_PREFIX = 'tickets:user:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ticketGateway: TicketGateway,
  ) {}

  private async invalidateCaches(ticketId?: string, userId?: string) {
    try {
      if (ticketId) {
        await this.redis.del(`${this.SINGLE_TICKET_PREFIX}${ticketId}`);
        if (userId) {
          await this.redis.del(
            `${this.SINGLE_TICKET_PREFIX}${ticketId}:${userId}`,
          );
        }
      }

      const client = this.redis.getClient();
      const listKeys = await client.keys(`${this.LIST_TICKETS_PREFIX}*`);
      const userKeys = await client.keys(`${this.USER_TICKETS_PREFIX}*`);
      const allKeys = [...listKeys, ...userKeys];

      if (allKeys.length > 0) {
        await client.del(...allKeys);
      }
    } catch {
      // Silently ignore cache invalidation failures
    }
  }

  async createTicket(userId: string, dto: CreateUserTicketDto) {
    try {
      const count = await this.prisma.ticket.count();
      const ticketNumber = `TK-${1000 + count + 1}`;

      const ticket = await this.prisma.ticket.create({
        data: {
          ticketNumber,
          subject: dto.subject,
          description: dto.description,
          category: dto.category || 'General',
          priority: dto.priority || TicketPriority.MEDIUM,
          preferredContactMethod:
            dto.preferredContactMethod || PreferredContactMethod.EMAIL,
          attachments: dto.attachments || [],
          authId: userId,
          messages: {
            create: {
              senderId: userId,
              message: dto.description,
              isAgent: false,
            },
          },
        },
        include: {
          auth: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      await this.invalidateCaches(undefined, userId);

      // Emit realtime ticket status changed event
      this.ticketGateway.publishTicketEvent(
        TicketSocketEvents.TICKET_STATUS_CHANGED,
        ticket.id,
        {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          createdAt: ticket.createdAt,
        },
      );

      return {
        message: 'Ticket submitted successfully',
        data: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          preferredContactMethod: ticket.preferredContactMethod,
          attachments: ticket.attachments,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        },
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to create support ticket: ${errMessage}`,
      );
    }
  }

  async getUserTickets(
    userId: string,
    query: QueryUserTicketDto,
  ): Promise<FormattedTicketResponse> {
    try {
      const cacheKey = `${this.USER_TICKETS_PREFIX}${userId}:${JSON.stringify(query)}`;
      const cached = await this.redis.get<FormattedTicketResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const {
        search,
        status,
        category,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 10,
      } = query;

      const pageNum = Number(page) > 0 ? Number(page) : 1;
      const limitNum = Number(limit) > 0 ? Number(limit) : 10;
      const skip = (pageNum - 1) * limitNum;

      const where: TicketWhereInput = {
        authId: userId,
      };

      if (status) {
        where.status = status;
      }

      if (category) {
        where.category = { contains: category, mode: 'insensitive' };
      }

      if (search && search.trim() !== '') {
        const cleanSearch = search.trim();
        where.OR = [
          { ticketNumber: { contains: cleanSearch, mode: 'insensitive' } },
          { subject: { contains: cleanSearch, mode: 'insensitive' } },
          { description: { contains: cleanSearch, mode: 'insensitive' } },
          { category: { contains: cleanSearch, mode: 'insensitive' } },
        ];
      }

      const [
        totalItems,
        openCount,
        inProgressCount,
        resolvedCount,
        closedCount,
        tickets,
      ] = await Promise.all([
        this.prisma.ticket.count({ where }),
        this.prisma.ticket.count({
          where: { authId: userId, status: TicketStatus.OPEN },
        }),
        this.prisma.ticket.count({
          where: { authId: userId, status: TicketStatus.IN_PROGRESS },
        }),
        this.prisma.ticket.count({
          where: { authId: userId, status: TicketStatus.RESOLVED },
        }),
        this.prisma.ticket.count({
          where: { authId: userId, status: TicketStatus.CLOSED },
        }),
        this.prisma.ticket.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limitNum,
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                message: true,
                createdAt: true,
                isAgent: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalItems / limitNum) || 1;

      const formattedTickets = tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        description: t.description,
        category: t.category || 'General',
        priority: t.priority,
        status: t.status,
        preferredContactMethod: t.preferredContactMethod,
        attachments: t.attachments,
        lastMessage: t.messages[0] || null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

      const result: FormattedTicketResponse = {
        message: 'User tickets retrieved successfully',
        data: {
          statusCounts: {
            OPEN: openCount,
            IN_PROGRESS: inProgressCount,
            RESOLVED: resolvedCount,
            CLOSED: closedCount,
            TOTAL: openCount + inProgressCount + resolvedCount + closedCount,
          },
          pagination: {
            totalItems,
            currentPage: pageNum,
            limit: limitNum,
            totalPages,
          },
          tickets: formattedTickets,
        },
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to retrieve user tickets: ${errMessage}`,
      );
    }
  }

  async getTicketById(
    userId: string,
    userRole: string,
    ticketIdOrNumber: string,
  ): Promise<SingleTicketResponse> {
    try {
      const cacheKey = `${this.SINGLE_TICKET_PREFIX}${ticketIdOrNumber}:${userId}`;
      const cached = await this.redis.get<SingleTicketResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const cleanIdentifier = ticketIdOrNumber.replace(/^#/, '').trim();

      const ticket = await this.prisma.ticket.findFirst({
        where: {
          OR: [
            { id: cleanIdentifier },
            { ticketNumber: cleanIdentifier },
            { ticketNumber: `#${cleanIdentifier}` },
            { ticketNumber: `TK-${cleanIdentifier}` },
          ],
        },
        include: {
          auth: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!ticket) {
        throw new NotFoundException(
          `Ticket with identifier "${ticketIdOrNumber}" not found`,
        );
      }

      // Check ownership unless admin
      if (ticket.authId !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException(
          'You do not have permission to view this ticket',
        );
      }

      const result: SingleTicketResponse = {
        message: 'Ticket details retrieved successfully',
        data: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          description: ticket.description,
          category: ticket.category || 'General',
          priority: ticket.priority,
          status: ticket.status,
          preferredContactMethod: ticket.preferredContactMethod,
          attachments: ticket.attachments,
          user: {
            id: ticket.auth.id,
            fullName: ticket.auth.fullName,
            email: ticket.auth.email,
          },
          assignedTo: ticket.assignedTo
            ? {
                id: ticket.assignedTo.id,
                fullName: ticket.assignedTo.fullName,
                email: ticket.assignedTo.email,
              }
            : null,
          messages: ticket.messages.map((m) => ({
            id: m.id,
            message: m.message,
            isAgent: m.isAgent,
            createdAt: m.createdAt,
            sender: {
              id: m.sender.id,
              fullName: m.sender.fullName,
              email: m.sender.email,
              role: m.sender.role,
            },
          })),
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        },
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to fetch ticket details: ${errMessage}`,
      );
    }
  }

  async addMessage(
    userId: string,
    userRole: string,
    ticketId: string,
    dto: CreateTicketMessageDto,
  ) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      // Ownership check unless admin
      if (ticket.authId !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException(
          'You are not authorized to send messages on this ticket',
        );
      }

      const isAgent = userRole === 'ADMIN';

      // If user replies on a RESOLVED ticket, change back to IN_PROGRESS
      let newStatus = ticket.status;
      if (!isAgent && ticket.status === TicketStatus.RESOLVED) {
        newStatus = TicketStatus.IN_PROGRESS;
      } else if (isAgent && ticket.status === TicketStatus.OPEN) {
        newStatus = TicketStatus.IN_PROGRESS;
      }

      const [createdMessage, updatedTicket] = await Promise.all([
        this.prisma.ticketMessage.create({
          data: {
            ticketId,
            senderId: userId,
            message: dto.message,
            isAgent,
          },
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        this.prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: newStatus,
            updatedAt: new Date(),
          },
        }),
      ]);

      await this.invalidateCaches(ticketId, ticket.authId);

      const messagePayload = {
        id: createdMessage.id,
        ticketId,
        message: createdMessage.message,
        isAgent: createdMessage.isAgent,
        createdAt: createdMessage.createdAt,
        sender: {
          id: createdMessage.sender.id,
          fullName: createdMessage.sender.fullName,
          email: createdMessage.sender.email,
          role: createdMessage.sender.role,
        },
        ticketStatus: updatedTicket.status,
      };

      // Realtime event publishing over WebSocket & Redis Pub/Sub
      this.ticketGateway.publishTicketEvent(
        TicketSocketEvents.TICKET_MESSAGE_RECEIVED,
        ticketId,
        messagePayload,
      );

      return {
        message: 'Message sent successfully',
        data: messagePayload,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to add message to ticket: ${errMessage}`,
      );
    }
  }

  async getTicketMessages(userId: string, userRole: string, ticketId: string) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      if (ticket.authId !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException(
          'You do not have permission to view this ticket messages',
        );
      }

      const messages = await this.prisma.ticketMessage.findMany({
        where: { ticketId },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      return {
        message: 'Messages retrieved successfully',
        data: messages,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      const errMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to fetch ticket messages: ${errMessage}`,
      );
    }
  }
}
