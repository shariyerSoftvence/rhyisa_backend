import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ClientProviderDirectoryService } from './client-provider-directory.service';
import { GetProviderAvailabilityDto } from './dto/client-provider-query.dto';

@ApiTags('Client Provider Directory and Availability Exploration')
@Controller('client/providers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClientProviderDirectoryController {
  constructor(
    private readonly directoryService: ClientProviderDirectoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all professional providers with basic portfolio data',
  })
  async getAllProviders() {
    return this.directoryService.getAllProviders();
  }

  @Get(':providerId')
  @ApiOperation({
    summary: 'Get a specific provider profile details by ID parameters',
  })
  async getProviderById(@Param('providerId') providerId: string) {
    return this.directoryService.getProviderById(providerId);
  }

  @Get(':providerId/services')
  @ApiOperation({
    summary:
      'List all operational execution items assigned under specified provider account',
  })
  async getAllServicesByProvider(@Param('providerId') providerId: string) {
    return this.directoryService.getAllServicesByProvider(providerId);
  }

  @Get(':providerId/availability')
  @ApiOperation({
    summary:
      'Calculate dynamic real-time slot lists checking operational blocks against book entries',
  })
  async getProviderAvailability(
    @Param('providerId') providerId: string,
    @Query() query: GetProviderAvailabilityDto,
  ) {
    return this.directoryService.getProviderAvailability(providerId, query);
  }
}
