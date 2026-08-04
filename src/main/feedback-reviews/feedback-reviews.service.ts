import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/client-review.dto';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class FeedbackReviewsService {
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private calculateDetailedRatingSummary(reviewsList: any[]) {
    if (!reviewsList || reviewsList.length === 0) {
      return {
        averageRating: 0.0,
        totalReviews: 0,
        recommendationPercentage: 0,
        ratingDistribution: {
          fiveStar: 0,
          fourStar: 0,
          threeStar: 0,
          twoStar: 0,
          oneStar: 0,
        },
      };
    }

    const totalReviews = reviewsList.length;
    let ratingsSum = 0;
    let positiveCount = 0;

    const distribution = {
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0,
    };

    reviewsList.forEach((review) => {
      ratingsSum += review.rating;

      if (review.rating >= 4) {
        positiveCount++;
      }

      // Categorize rating into distribution levels
      const roundedRating = Math.round(review.rating);
      if (roundedRating === 5) distribution.fiveStar++;
      else if (roundedRating === 4) distribution.fourStar++;
      else if (roundedRating === 3) distribution.threeStar++;
      else if (roundedRating === 2) distribution.twoStar++;
      else if (roundedRating === 1) distribution.oneStar++;
    });

    const averageRating = parseFloat((ratingsSum / totalReviews).toFixed(1));
    const recommendationPercentage = Math.round(
      (positiveCount / totalReviews) * 100,
    );

    return {
      averageRating,
      totalReviews,
      recommendationPercentage,
      ratingDistribution: {
        fiveStar: Math.round((distribution.fiveStar / totalReviews) * 100),
        fourStar: Math.round((distribution.fourStar / totalReviews) * 100),
        threeStar: Math.round((distribution.threeStar / totalReviews) * 100),
        twoStar: Math.round((distribution.twoStar / totalReviews) * 100),
        oneStar: Math.round((distribution.oneStar / totalReviews) * 100),
      },
    };
  }

  private calculateOverallRating(reviewsList: any[]) {
    if (!reviewsList || reviewsList.length === 0) {
      return { totalReviews: 0, averageRating: 0.0 };
    }
    const ratingsSum = reviewsList.reduce((acc, curr) => acc + curr.rating, 0);
    const averageComputed = parseFloat(
      (ratingsSum / reviewsList.length).toFixed(2),
    );
    return {
      totalReviews: reviewsList.length,
      averageRating: averageComputed,
    };
  }

  async getProviderReviewsPublic(providerId: string) {
    try {
      const cacheKey = `reviews:provider:${providerId}:public`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const providerExists = await this.prisma.providerProfile.findUnique({
        where: { id: providerId },
      });
      if (!providerExists) {
        throw new NotFoundException(
          'Target provider profile parameters matching query criteria missing',
        );
      }

      const reviewsCollection = await this.prisma.review.findMany({
        where: { providerId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const structuralMetricsSummary =
        this.calculateDetailedRatingSummary(reviewsCollection);

      const result = {
        overallRatingSummary: structuralMetricsSummary,
        reviews: reviewsCollection,
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to recover provider metric layers datasets: ${error.message}`,
      );
    }
  }

  async createClientReview(authId: string, dto: CreateReviewDto) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });
      if (!userProfile) {
        throw new NotFoundException(
          'Client identity profile records missing from registry',
        );
      }

      const targetBooking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { provider: true },
      });
      if (!targetBooking || targetBooking.userId !== userProfile.id) {
        throw new NotFoundException(
          'Target booking session reference logs matched poorly or missing',
        );
      }

      if (targetBooking.status !== 'COMPLETED') {
        throw new BadRequestException(
          'Feedback execution loops can only initialize after active booking states reach final completion blocks',
        );
      }

      const reviewAlreadySubmitted = await this.prisma.review.findUnique({
        where: { bookingId: dto.bookingId },
      });
      if (reviewAlreadySubmitted) {
        throw new ConflictException(
          'Critical exception constraints: Target verification index token already submitted a review element log',
        );
      }

      const newReview = await this.prisma.review.create({
        data: {
          rating: dto.rating,
          comment: dto.comment,
          userId: userProfile.id,
          providerId: targetBooking.providerId,
          bookingId: dto.bookingId,
        },
      });

      await this.redis.del(`reviews:provider:${targetBooking.providerId}:public`);
      if (targetBooking.provider?.authId) {
        await this.redis.del(`reviews:provider:${targetBooking.provider.authId}:own`);
      }
      await this.redis.del(`directory:provider:${targetBooking.providerId}`);
      await this.redis.del('directory:providers:all');

      return newReview;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to construct and persist system metadata evaluation entry: ${error.message}`,
      );
    }
  }

  async getProviderOwnReviews(authId: string) {
    try {
      const cacheKey = `reviews:provider:${authId}:own`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const professionalProfile = await this.prisma.providerProfile.findUnique({
        where: { authId },
      });
      if (!professionalProfile) {
        throw new NotFoundException(
          'Provider profile not initialized for this account',
        );
      }

      const internalReviewsList = await this.prisma.review.findMany({
        where: { providerId: professionalProfile.id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingDate: true,
              service: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const profileCalculations =
        this.calculateDetailedRatingSummary(internalReviewsList);

      const result = {
        overallRatingSummary: profileCalculations,
        reviews: internalReviewsList,
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to search assigned review configurations collection data: ${error.message}`,
      );
    }
  }

  async getReviewDetailsById(reviewId: string) {
    try {
      const cacheKey = `reviews:id:${reviewId}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const specificReviewItem = await this.prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
          booking: true,
        },
      });

      if (!specificReviewItem) {
        throw new NotFoundException(
          'Target data record registry entry context parameter omitted',
        );
      }

      await this.redis.set(cacheKey, specificReviewItem, this.CACHE_TTL);
      return specificReviewItem;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to execute system block target record data recovery process: ${error.message}`,
      );
    }
  }
}
