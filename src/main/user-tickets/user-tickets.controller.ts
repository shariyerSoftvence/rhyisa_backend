import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RoleType } from '../../../generated/prisma/enums';
import { UserTicketsService } from './user-tickets.service';
import { CreateUserTicketDto } from './dto/create-user-ticket.dto';
import { QueryUserTicketDto } from './dto/query-user-ticket.dto';
import { CreateTicketMessageDto } from '../admin/ticket-management/dto/create-ticket-message.dto';

interface AuthenticatedRequest {
  user: {
    id: string;
    role: RoleType;
  };
}

@ApiTags('User Support Tickets System')
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.USER, RoleType.PROVIDER, RoleType.ADMIN)
@ApiBearerAuth()
export class UserTicketsController {
  constructor(private readonly userTicketsService: UserTicketsService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit a new support ticket (User)',
    description:
      'Allows a registered user to submit a ticket with subject, description, preferred contact method (Email/Phone), attachments, and category.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Ticket created cleanly with generated #TK number and initial message.',
  })
  async createTicket(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateUserTicketDto,
  ) {
    const userId = req.user.id;
    return this.userTicketsService.createTicket(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Get user support tickets list with tabs (Open, In Progress, Resolved, Closed), search & pagination',
    description:
      'Retrieves all tickets submitted by the logged-in user with status filters, search keyword, and pagination. Cached in Redis.',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of user tickets and status metadata retrieved successfully.',
  })
  async getUserTickets(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryUserTicketDto,
  ) {
    const userId = req.user.id;
    return this.userTicketsService.getUserTickets(userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Fetch ticket details and conversation thread messages by Ticket ID or Number (e.g. TK-1246)',
    description:
      'Returns single ticket metadata and message history thread for the owner user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket details retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket not found.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Ticket owned by another user.',
  })
  async getTicketById(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    return this.userTicketsService.getTicketById(userId, userRole, id);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Send reply message in ticket conversation thread (User -> Admin)',
    description:
      'Appends a user message to the ticket conversation. Broadcasted in real-time via Socket.IO and Redis Pub/Sub.',
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully and broadcasted in real time.',
  })
  async addMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    return this.userTicketsService.addMessage(userId, userRole, id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Fetch all conversation thread messages for a ticket (User)',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages array retrieved.',
  })
  async getTicketMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user.id;
    const userRole = req.user.role;
    return this.userTicketsService.getTicketMessages(userId, userRole, id);
  }
}
