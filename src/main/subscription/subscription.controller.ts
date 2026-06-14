import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RoleType } from '../../../generated/prisma/enums';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Platform Premium Access & Payments Core Processing Modules')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({
    summary:
      'Retrieve clean lists of premium features and tiered operational capabilities data sets',
  })
  async getPlans() {
    return this.subscriptionService.getAllAvailablePlans();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.USER)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Compile new Stripe transactional checking operations against client entries',
  })
  async createCheckout(@Req() req: any, @Body('planId') planId: string) {
    return this.subscriptionService.createCheckoutSession(req.user.id, planId);
  }
}
