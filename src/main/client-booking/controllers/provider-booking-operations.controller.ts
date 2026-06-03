import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoleType } from '../../../../generated/prisma/enums';
import { ProviderBookingOperationsService } from '../services/provider-booking-operations.service';
import { UpdateBookingStatusDto } from '../dto/booking-status-update.dto';

@ApiTags('Provider Dashboard Booking Parameters Administration')
@Controller('provider/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.PROVIDER)
@ApiBearerAuth()
export class ProviderBookingOperationsController {
  constructor(
    private readonly providerBookingService: ProviderBookingOperationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List all operational execution records assigned under active professional token account',
  })
  async getMyAllBookings(@Req() req: any) {
    return this.providerBookingService.getProviderBookings(req.user.id);
  }

  @Get(':bookingId')
  @ApiOperation({
    summary:
      'Pull specific operational metrics parameter log info matching registration ID',
  })
  async getSingleBooking(
    @Req() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.providerBookingService.getProviderBookingById(
      req.user.id,
      bookingId,
    );
  }

  @Patch(':bookingId/status')
  @ApiOperation({
    summary:
      'Modify operational indices state attributes dynamically to final status elements',
  })
  async updateStatus(
    @Req() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.providerBookingService.updateBookingStatus(
      req.user.id,
      bookingId,
      dto,
    );
  }
}
