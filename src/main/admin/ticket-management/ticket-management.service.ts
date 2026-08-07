import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ExecutiveDashboardService } from '../executive-dashboard/executive-dashboard.service';
import { TicketGateway, TicketSocketEvents } from './ticket.gateway';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import {
  PaymentStatus,
  TicketPriority,
  TicketStatus,
} from '../../../../generated/prisma/enums';

@Injectable()
export class TicketManagementService {
  private readonly CACHE_TTL = 180; // 3 minutes
  private readonly SINGLE_TICKET_PREFIX = 'ticket:detail:';
  private readonly LIST_TICKETS_PREFIX = 'tickets:list:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly executiveDashboardService: ExecutiveDashboardService,
    private readonly ticketGateway: TicketGateway,
  ) {}

  private async invalidateCaches(ticketId?: string) {
    try {
      await this.executiveDashboardService.invalidateOverviewCache();
      if (ticketId) {
        await this.redis.del(`${this.SINGLE_TICKET_PREFIX}${ticketId}`);
      }
      const client = this.redis.getClient();
      const keys = await client.keys(`${this.LIST_TICKETS_PREFIX}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // Ignore cache invalidation failures silently
    }
  }

  private calculateGrowth(todayCount: number, prevCount: number): number {
    if (prevCount === 0) {
      return todayCount > 0 ? 100 : 0;
    }
    return Number((((todayCount - prevCount) / prevCount) * 100).toFixed(2));
  }

  async getAllTickets(query: QueryTicketDto) {
    try {
      const cacheKey = `${this.LIST_TICKETS_PREFIX}${JSON.stringify(query)}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      const {
        search,
        status,
        category,
        priority,
        assignedToId,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 10,
      } = query;

      const pageNum = Number(page) > 0 ? Number(page) : 1;
      const limitNum = Number(limit) > 0 ? Number(limit) : 10;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (category) {
        where.category = { contains: category, mode: 'insensitive' };
      }

      if (priority) {
        where.priority = priority;
      }

      if (assignedToId) {
        where.assignedToId = assignedToId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      if (search && search.trim() !== '') {
        const cleanSearch = search.trim();
        where.OR = [
          { ticketNumber: { contains: cleanSearch, mode: 'insensitive' } },
          { subject: { contains: cleanSearch, mode: 'insensitive' } },
          { description: { contains: cleanSearch, mode: 'insensitive' } },
          { category: { contains: cleanSearch, mode: 'insensitive' } },
          {
            auth: { fullName: { contains: cleanSearch, mode: 'insensitive' } },
          },
          { auth: { email: { contains: cleanSearch, mode: 'insensitive' } } },
        ];
      }

      // Stats metrics calculation matching the dashboard cards
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startOfYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      );
      const endOfYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        23,
        59,
        59,
        999,
      );

      const [
        totalTickets,
        ticketsToday,
        ticketsYesterday,
        openCount,
        openToday,
        openYesterday,
        inProgressCount,
        inProgressToday,
        inProgressYesterday,
        resolvedCount,
        resolvedToday,
        resolvedYesterday,
        closedCount,
        tickets,
      ] = await Promise.all([
        this.prisma.ticket.count({ where }),
        this.prisma.ticket.count({
          where: { ...where, createdAt: { gte: startOfToday } },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        this.prisma.ticket.count({
          where: { ...where, status: TicketStatus.OPEN },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            status: TicketStatus.OPEN,
            createdAt: { gte: startOfToday },
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            status: TicketStatus.OPEN,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        this.prisma.ticket.count({
          where: { ...where, status: TicketStatus.IN_PROGRESS },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            status: TicketStatus.IN_PROGRESS,
            createdAt: { gte: startOfToday },
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            status: TicketStatus.IN_PROGRESS,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        this.prisma.ticket.count({
          where: { ...where, status: TicketStatus.RESOLVED },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            status: TicketStatus.RESOLVED,
            createdAt: { gte: startOfToday },
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...where,
            status: TicketStatus.RESOLVED,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        this.prisma.ticket.count({
          where: { ...where, status: TicketStatus.CLOSED },
        }),

        this.prisma.ticket.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limitNum,
          include: {
            auth: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                createdAt: true,
                userProfile: {
                  select: {
                    profileImage: true,
                    subscriptionType: true,
                  },
                },
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
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { message: true, createdAt: true, isAgent: true },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalTickets / limitNum) || 1;

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
        user: {
          id: t.auth.id,
          fullName: t.auth.fullName,
          email: t.auth.email,
          role: t.auth.role,
          membershipSince: t.auth.createdAt,
          subscriptionType: t.auth.userProfile?.subscriptionType || 'FREE',
          profileImage: t.auth.userProfile?.profileImage?.url || null,
        },
        assignedTo: t.assignedTo
          ? {
              id: t.assignedTo.id,
              fullName: t.assignedTo.fullName,
              email: t.assignedTo.email,
            }
          : null,
        lastMessage: t.messages[0] || null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

      const result = {
        message: 'Tickets retrieved successfully',
        data: {
          stats: {
            totalTickets: {
              count: totalTickets,
              growthPercentage: this.calculateGrowth(
                ticketsToday,
                ticketsYesterday,
              ),
            },
            openTickets: {
              count: openCount,
              growthPercentage: this.calculateGrowth(openToday, openYesterday),
            },
            inProgressTickets: {
              count: inProgressCount,
              growthPercentage: this.calculateGrowth(
                inProgressToday,
                inProgressYesterday,
              ),
            },
            resolvedTickets: {
              count: resolvedCount,
              growthPercentage: this.calculateGrowth(
                resolvedToday,
                resolvedYesterday,
              ),
            },
            closedTickets: {
              count: closedCount,
            },
          },
          pagination: {
            totalItems: totalTickets,
            currentPage: pageNum,
            limit: limitNum,
            totalPages,
          },
          tickets: formattedTickets,
        },
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to retrieve tickets: ${error.message}`,
      );
    }
  }

  async getTicketById(ticketIdOrNumber: string) {
    try {
      const cacheKey = `${this.SINGLE_TICKET_PREFIX}${ticketIdOrNumber}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      // Check if ticket ID or ticketNumber (e.g. TK-1250 or #TK-1250)
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
              createdAt: true,
              userProfile: {
                select: {
                  subscriptionType: true,
                  subscribed: {
                    select: {
                      amountPaid: true,
                      plan: { select: { name: true } },
                    },
                  },
                  bookings: {
                    where: { payment: { status: PaymentStatus.SUCCESSFUL } },
                    select: {
                      payment: { select: { totalAmount: true } },
                    },
                  },
                },
              },
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

      // Calculate total spend by user
      const bookingSpend =
        ticket.auth.userProfile?.bookings.reduce(
          (acc, b) => acc + (b.payment?.totalAmount || 0),
          0,
        ) || 0;
      const subSpend = ticket.auth.userProfile?.subscribed?.amountPaid || 0;
      const totalSpend = Number((bookingSpend + subSpend).toFixed(2));

      const planName =
        ticket.auth.userProfile?.subscribed?.plan.name ||
        (ticket.auth.userProfile?.subscriptionType === 'PREMIUM'
          ? 'Premium Annual'
          : 'Free');

      const result = {
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
            plan: planName,
            totalSpend: `$${totalSpend.toFixed(2)}`,
            membershipSince: ticket.auth.createdAt,
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
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to fetch ticket details: ${error.message}`,
      );
    }
  }

  async createTicket(userId: string, dto: CreateTicketDto) {
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
          preferredContactMethod: dto.preferredContactMethod,
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
          auth: { select: { id: true, fullName: true, email: true } },
          messages: true,
        },
      });

      await this.invalidateCaches();

      // Emit event
      this.ticketGateway.publishTicketEvent(
        TicketSocketEvents.TICKET_STATUS_CHANGED,
        ticket.id,
        {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
        },
      );

      return {
        message: 'Ticket submitted successfully',
        data: ticket,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to create ticket: ${error.message}`,
      );
    }
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      const updated = await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status, updatedAt: new Date() },
        include: {
          auth: { select: { id: true, fullName: true, email: true } },
        },
      });

      await this.invalidateCaches(ticketId);

      this.ticketGateway.publishTicketEvent(
        TicketSocketEvents.TICKET_STATUS_CHANGED,
        ticketId,
        {
          ticketId: updated.id,
          ticketNumber: updated.ticketNumber,
          status: updated.status,
          updatedAt: updated.updatedAt,
        },
      );

      return {
        message: `Ticket status updated to ${status}`,
        data: updated,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to update ticket status: ${error.message}`,
      );
    }
  }

  async updateTicketPriority(ticketId: string, priority: TicketPriority) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      const updated = await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { priority, updatedAt: new Date() },
      });

      await this.invalidateCaches(ticketId);

      return {
        message: `Ticket priority updated to ${priority}`,
        data: updated,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to update ticket priority: ${error.message}`,
      );
    }
  }

  async assignTicket(ticketId: string, adminId?: string) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      if (adminId) {
        const admin = await this.prisma.auth.findUnique({
          where: { id: adminId },
        });
        if (!admin) {
          throw new BadRequestException(
            `Admin user with ID ${adminId} not found`,
          );
        }
      }

      const updated = await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          assignedToId: adminId || null,
          updatedAt: new Date(),
        },
        include: {
          assignedTo: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });

      await this.invalidateCaches(ticketId);

      return {
        message: adminId ? 'Ticket assigned successfully' : 'Ticket unassigned',
        data: updated,
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to assign ticket: ${error.message}`,
      );
    }
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    dto: CreateTicketMessageDto,
    isAgent: boolean = false,
  ) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      // If admin replies and ticket was OPEN, change to IN_PROGRESS
      let newStatus = ticket.status;
      if (isAgent && ticket.status === TicketStatus.OPEN) {
        newStatus = TicketStatus.IN_PROGRESS;
      }

      const [createdMessage, updatedTicket] = await Promise.all([
        this.prisma.ticketMessage.create({
          data: {
            ticketId,
            senderId,
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

      await this.invalidateCaches(ticketId);

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

      // Publish realtime event to ticket room via Socket.io & Redis Pub/Sub
      this.ticketGateway.publishTicketEvent(
        TicketSocketEvents.TICKET_MESSAGE_RECEIVED,
        ticketId,
        messagePayload,
      );

      return {
        message: 'Message added successfully',
        data: messagePayload,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to add message to ticket: ${error.message}`,
      );
    }
  }

  async getTicketMessages(ticketId: string) {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
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
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to fetch ticket messages: ${error.message}`,
      );
    }
  }
}
