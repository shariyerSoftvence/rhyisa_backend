import { Module } from '@nestjs/common';
import { FeedbackReviewsService } from './feedback-reviews.service';
import { FeedbackReviewsController } from './feedback-reviews.controller';

@Module({
  providers: [FeedbackReviewsService],
  controllers: [FeedbackReviewsController],
})
export class FeedbackReviewsModule {}
