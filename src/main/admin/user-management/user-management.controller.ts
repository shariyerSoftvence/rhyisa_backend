import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UserManagementService } from './user-management.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProviderStatus, RoleType, UserStatus } from '../../../../generated/prisma/enums';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';


@ApiTags('ADMIN User Management Systems (Admin Operations Portfolio)')
@Controller('admin/user-management')
@UseGuards(JwtAuthGuard ,RolesGuard)
@Roles(RoleType.ADMIN)
@ApiBearerAuth()
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all platform standard accounts users records metadata profile list (Admin Only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'User metadata parameters collections structure array mapped successfully.' })
  async findAllUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.userManagementService.getAllUsers(pageNum, limitNum);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get all verified provider registration listings (Admin Only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Provider structural index profiles array parsed data elements mapped successfully.' })
  async findAllProviders(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.userManagementService.getAllProviders(pageNum, limitNum);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Fetch single user record details profile tracking metrics log attributes (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Target user structural schema metadata analysis response profile mapped successfully.' })
  @ApiResponse({ status: 404, description: 'Target profile object index trace missing matching reference context keys.' })
  async findOneUser(@Param('id') id: string) {
    return this.userManagementService.getSingleUser(id);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Fetch single provider verification data fields record parameters profile tracking metrics metadata (Admin Only)' })
  @ApiResponse({ status: 200, description: 'Target provider system parameter schema entity mapped successfully.' })
  @ApiResponse({ status: 404, description: 'Target entity key identifier string path parameters mapping tracking reference key error.' })
  async findOneProvider(@Param('id') id: string) {
    return this.userManagementService.getSingleProvider(id);
  }


 @Patch('accounts/:id/status')
  @ApiOperation({ summary: 'Change the account status of a user or provider (Admin Only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { 
          type: 'string', 
          enum: [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.DELETED, UserStatus.BLOCKED], 
          example: UserStatus.BLOCKED 
        }
      },
      required: ['status']
    }
  })
  @ApiResponse({ status: 200, description: 'Account status successfully updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status value or account already has this status.' })
  @ApiResponse({ status: 404, description: 'Target account record missing.' })
  async updateAccountStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    return this.userManagementService.changeUserStatus(id, status);
  }

  @Patch('providers/:id/status')
  @ApiOperation({ summary: 'Accept or reject professional provider registration application credentials (Admin Only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: [ProviderStatus.ACCEPTED, ProviderStatus.REJECTED], example: ProviderStatus.ACCEPTED }
      },
      required: ['status']
    }
  })
  @ApiResponse({ status: 200, description: 'Verification workflow application context processed successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid payload operational data schema elements.' })
  @ApiResponse({ status: 404, description: 'Target business entity tracking references not discovered.' })
  async updateProviderStatus(
    @Param('id') id: string,
    @Body('status') status: ProviderStatus,
  ) {
    return this.userManagementService.actionProviderRequest(id, status);
  }
}