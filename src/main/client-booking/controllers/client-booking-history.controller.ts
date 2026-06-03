import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ClientBookingHistoryService } from '../services/client-booking-history.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RoleType } from '../../../../generated/prisma/enums';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('Client Booking History and Summary Records')
@Controller('client/bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.USER)
@ApiBearerAuth()
export class ClientBookingHistoryController {
  constructor(
    private readonly clientHistoryService: ClientBookingHistoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Pull all personalized booking profiles assigned under active authenticated client token account',
  })
  async getMyAllBookings(@Req() req: any) {
    return this.clientHistoryService.getClientBookings(req.user.id);
  }

  @Get(':bookingId')
  @ApiOperation({
    summary: 'Pull data details indices parameter matching target booking ID',
  })
  async getSingleBooking(
    @Req() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.clientHistoryService.getClientBookingById(
      req.user.id,
      bookingId,
    );
  }
}
