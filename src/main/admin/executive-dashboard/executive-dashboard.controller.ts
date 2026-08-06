import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RoleType } from '../../../../generated/prisma/enums';
import { ExecutiveDashboardService } from './executive-dashboard.service';

@ApiTags('ADMIN Executive Dashboard')
@Controller('admin/executive-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@ApiBearerAuth()
export class ExecutiveDashboardController {
  constructor(
    private readonly executiveDashboardService: ExecutiveDashboardService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Get Executive Dashboard Overview (Active Users, Active Providers, New Users Growth, Conversions, Total Tickets) (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview data calculated and returned successfully.',
  })
  async getOverview() {
    return this.executiveDashboardService.getOverviewData();
  }

  @Get('monthly-overview')
  @ApiOperation({
    summary:
      'Get Monthly Revenue Overview and User Growth breakdown by month (Admin Only)',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Year for monthly statistics (e.g. 2026). Defaults to current year.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Monthly revenue overview and user growth data returned successfully.',
  })
  async getMonthlyOverview(@Query('year') year?: string) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    return this.executiveDashboardService.getMonthlyRevenueAndUserGrowth(
      parsedYear,
    );
  }
}
