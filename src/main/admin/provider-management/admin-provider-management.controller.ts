import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { AdminProviderManagementService } from './admin-provider-management.service';
import { QueryProviderDto } from './dto/query-provider.dto';
import { ActionProviderDto } from './dto/action-provider.dto';
import { RequestMoreInfoDto } from './dto/request-more-info.dto';

@ApiTags('ADMIN Healthcare Provider Verification & Management Systems')
@Controller('admin/provider-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@ApiBearerAuth()
export class AdminProviderManagementController {
  constructor(
    private readonly providerManagementService: AdminProviderManagementService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary:
      'Get provider application metrics overview stats (Total, Pending, Approved, Denied, Suspended) (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Header cards metrics statistics retrieved cleanly.',
  })
  async getProviderStats() {
    return this.providerManagementService.getProviderStats();
  }

  @Get()
  @ApiOperation({
    summary:
      'View all provider applications with search, status filters (ALL, PENDING, ACCEPTED, REJECTED, SUSPENDED), sorting and pagination (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Providers table array and status metadata retrieved successfully.',
  })
  async getAllProviders(@Query() query: QueryProviderDto) {
    return this.providerManagementService.getAllProviders(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Fetch single provider details, submitted credentials documentation & review notes by Provider ID or Auth ID (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Provider detailed drawer metadata and submitted documents array retrieved cleanly.',
  })
  @ApiResponse({
    status: 404,
    description: 'Provider profile record missing.',
  })
  async getSingleProvider(@Param('id') id: string) {
    return this.providerManagementService.getSingleProvider(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Approve (ACCEPTED), Deny (REJECTED), or Suspend/Block (SUSPENDED) a provider application with review notes (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Provider status successfully updated and user auth status synchronized.',
  })
  @ApiResponse({
    status: 404,
    description: 'Target provider profile record not found.',
  })
  async actionProvider(
    @Param('id') id: string,
    @Body() dto: ActionProviderDto,
  ) {
    return this.providerManagementService.actionProvider(id, dto);
  }

  @Post(':id/request-info')
  @ApiOperation({
    summary:
      'Request more information or missing documentation from provider with review notes (Admin Only)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Request for additional info logged and notification notes updated.',
  })
  async requestMoreInfo(
    @Param('id') id: string,
    @Body() dto: RequestMoreInfoDto,
  ) {
    return this.providerManagementService.requestMoreInfo(id, dto);
  }
}
