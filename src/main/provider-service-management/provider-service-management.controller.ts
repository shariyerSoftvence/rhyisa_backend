import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';
import { StripeVerifiedGuard } from '../../common/guards/stripe-verified.guard';
import { ProviderServiceManagementService } from './provider-service-management.service';

@ApiTags('Provider Services Portfolio Administration')
@Controller('provider/services')
@UseGuards(JwtAuthGuard, RolesGuard, StripeVerifiedGuard)
@Roles(RoleType.PROVIDER)
@ApiBearerAuth()
export class ProviderServiceManagementController {
  constructor(
    private readonly serviceManager: ProviderServiceManagementService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Add a new service catalogue allocation item inside profile parameters',
  })
  @ApiResponse({
    status: 201,
    description: 'Service rule data record registered successfully.',
  })
  async createService(@Req() req: any, @Body() dto: CreateServiceDto) {
    return this.serviceManager.createProviderServices(req.user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List all personalized execution services maps assigned under active token account',
  })
  async getAllServices(@Req() req: any) {
    return this.serviceManager.getAllProviderService(req.user.id);
  }

  @Get(':serviceId')
  @ApiOperation({
    summary:
      'Pull target service specific log details indices parameter matching ID',
  })
  async getServiceById(@Req() req: any, @Param('serviceId') serviceId: string) {
    return this.serviceManager.getProviderServiceById(req.user.id, serviceId);
  }

  @Patch(':serviceId')
  @ApiOperation({
    summary:
      'Modify financial rules cost rates or baseline values attributes dynamically',
  })
  async updateService(
    @Req() req: any,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.serviceManager.updateProviderServices(req.user.id, serviceId, dto);
  }

  @Delete(':serviceId')
  @ApiOperation({
    summary:
      'Purge target catalogue execution profile item directly out from active database cluster',
  })
  async removeService(@Req() req: any, @Param('serviceId') serviceId: string) {
    return this.serviceManager.deleteProviderService(req.user.id, serviceId);
  }
}
