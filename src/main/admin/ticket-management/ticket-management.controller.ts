import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RoleType } from '../../../../generated/prisma/enums';
import { TicketManagementService } from './ticket-management.service';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import {
  AssignTicketDto,
  UpdateTicketPriorityDto,
  UpdateTicketStatusDto,
} from './dto/update-ticket.dto';

@ApiTags('ADMIN Support Center & Ticket Management Systems')
@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@ApiBearerAuth()
export class TicketManagementController {
  constructor(
    private readonly ticketManagementService: TicketManagementService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'View all support tickets with search, status/category/priority/date filtering, sorting and pagination (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tickets list and statistics metadata retrieved cleanly.',
  })
  async getAllTickets(@Query() query: QueryTicketDto) {
    return this.ticketManagementService.getAllTickets(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Fetch single ticket details, user info, spend statistics & conversation messages by ID or Ticket Number (e.g. TK-1250) (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket structural schema metadata retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Ticket record missing.',
  })
  async getTicketById(@Param('id') id: string) {
    return this.ticketManagementService.getTicketById(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Submit a new support ticket (Admin or User)',
  })
  @ApiResponse({
    status: 201,
    description: 'Ticket created successfully.',
  })
  async createTicket(@Req() req: any, @Body() dto: CreateTicketDto) {
    const userId = req.user.id;
    return this.ticketManagementService.createTicket(userId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Change status of a ticket (OPEN, IN_PROGRESS, RESOLVED, CLOSED) (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket status successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Target ticket missing.' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketManagementService.updateTicketStatus(id, dto.status);
  }

  @Patch(':id/priority')
  @ApiOperation({
    summary:
      'Update priority of a ticket (LOW, MEDIUM, HIGH, URGENT) (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket priority successfully updated.',
  })
  async updatePriority(
    @Param('id') id: string,
    @Body() dto: UpdateTicketPriorityDto,
  ) {
    return this.ticketManagementService.updateTicketPriority(id, dto.priority);
  }

  @Patch(':id/assign')
  @ApiOperation({
    summary: 'Assign or unassign a support ticket to an admin (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket assignment updated cleanly.',
  })
  async assignTicket(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.ticketManagementService.assignTicket(id, dto.adminId);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary:
      'Send reply message in a ticket conversation (Admin Agent) (Admin Only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Reply message created and broadcasted via socket/redis.',
  })
  async addMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    const adminId = req.user.id;
    return this.ticketManagementService.addMessage(id, adminId, dto, true);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Fetch all conversation messages for a ticket (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket conversation messages array retrieved.',
  })
  async getMessages(@Param('id') id: string) {
    return this.ticketManagementService.getTicketMessages(id);
  }
}
