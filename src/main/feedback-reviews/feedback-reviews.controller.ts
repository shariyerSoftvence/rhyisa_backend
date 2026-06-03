import {
  Controller,
  Get,
  Post,
  Param,
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';
import { FeedbackReviewsService } from './feedback-reviews.service';
import { CreateReviewDto } from './dto/client-review.dto';

@ApiTags('System Feedback and Review Metrics Architecture')
@Controller('reviews')
export class FeedbackReviewsController {
  constructor(private readonly reviewService: FeedbackReviewsService) {}

  @Get('public/provider/:providerId')
  @ApiOperation({
    summary:
      'Pull all assigned reviews portfolio metadata for specific public structural query with calculations',
  })
  async getReviewByProviderId(@Param('providerId') providerId: string) {
    return this.reviewService.getProviderReviewsPublic(providerId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Submit feedback evaluation parameters logs matching executed booking index',
  })
  async createReview(@Req() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewService.createClientReview(req.user.id, dto);
  }

  @Get('provider/my-reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.PROVIDER)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Pull all personal execution reviews profiles assigned under active professional token account',
  })
  async getMyProviderAllReviews(@Req() req: any) {
    return this.reviewService.getProviderOwnReviews(req.user.id);
  }

  @Get(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Pull target feedback review data row detail parameter matching configuration ID',
  })
  async getReviewById(@Param('reviewId') reviewId: string) {
    return this.reviewService.getReviewDetailsById(reviewId);
  }
}
