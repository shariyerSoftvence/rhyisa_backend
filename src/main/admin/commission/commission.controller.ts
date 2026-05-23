
import { Controller, Post, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateCommissionDto } from './dto/commission.dto';
import { AdminCommissionService } from './commission.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RoleType } from '../../../../generated/prisma/enums';


@ApiTags('ADMIN Commission Portal Control Modules')
@Controller('admin/commission')
@ApiBearerAuth()
export class AdminCommissionController {
  constructor(private readonly commissionService: AdminCommissionService) {}

  @Get('public')
  @ApiOperation({ summary: 'Pull the active global system commission setup for public components access' })
  @ApiResponse({ status: 200, description: 'Global commission rules properties schema returned successfully.' })
  async getPublicCommission() {
    return this.commissionService.getCommission();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create global system commission rule configuration' })
  @ApiResponse({ status: 201, description: 'Commission rule created cleanly.' })
  async createCommission(@Body() dto: UpdateCommissionDto) {
    return this.commissionService.createCommission(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Pull the current global system configuration metrics parameters (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Global parameters entry record returned.' })
  async getCommission() {
    return this.commissionService.getCommission();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update the global system commission rule properties metrics (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Global platform configuration variables entry overwritten successfully.' })
  async updateCommission(@Body() dto: UpdateCommissionDto) {
    return this.commissionService.updateCommission(dto);
  }
}
