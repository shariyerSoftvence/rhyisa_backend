import { Controller, Post, Body, UseGuards, Req, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ClientBookingService } from '../services/client-booking.service';
import {
  CreateBookingDto,
  RescheduleBookingDto,
} from '../dto/client-booking.dto';

@ApiTags('Client Bookings Operations')
@Controller('client/bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClientBookingController {
  constructor(private readonly bookingService: ClientBookingService) {}

  @Post('checkout-session')
  @ApiOperation({
    summary:
      'Initiate a service booking request and generate a Stripe Checkout session',
  })
  @ApiResponse({
    status: 201,
    description: 'Stripe Session URL created successfully.',
  })
  async createCheckoutSession(@Req() req: any, @Body() dto: CreateBookingDto) {
    return this.bookingService.initiateBookingCheckout(req.user.id, dto);
  }

  @Post(':bookingId/reschedule')
  @ApiOperation({
    summary:
      'Reschedule an active confirmed booking with conflict validation metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking slot successfully updated.',
  })
  async reschedule(
    @Req() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingService.rescheduleBooking(req.user.id, bookingId, dto);
  }

  @Post(':bookingId/cancel')
  @ApiOperation({
    summary:
      'Cancel a booking entry and trigger automated system refund processes via Stripe API',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled and transaction successfully refunded.',
  })
  async cancelAndRefund(
    @Req() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.bookingService.cancelWithRefund(req.user.id, bookingId);
  }
}
