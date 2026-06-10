1; // UPDATED SERVICE FILE: track-meal.service.ts

import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OpenaiService } from '../openai/openai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackMealTextDto } from './dto/track-meal.dto';
import { RedisService } from '../../common/redis/redis.service';
import { LogDailyMetricsDto } from './dto/log-daily-metrics.dto';

@Injectable()
export class TrackMealService {
  constructor(
    private readonly openaiService: OpenaiService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async trackFromText(authId: string, dto: TrackMealTextDto) {
    try {
      const mealData = await this.openaiService.processTextToMealData(dto.text);

      if (!mealData.isValidMeal) {
        throw new BadRequestException(
          'The provided text could not be recognized as a valid meal item',
        );
      }

      // Cache temporary pending data for 10 minutes (600 seconds)
      const cacheKey = `pending_meal:${authId}`;
      await this.redisService.set(cacheKey, mealData, 600);

      return {
        success: true,
        data: mealData,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Failed to track meal from text: ${error.message}`,
      );
    }
  }

 async trackFromVoice(authId: string, filePath: string) {
  if (!filePath) {
    throw new BadRequestException('Voice audio path context missing');
  }

  try {
    const mealData = await this.openaiService.processVoiceToMealDataDirect(filePath);

    if (!mealData.isValidMeal) {
      throw new BadRequestException(
        'The transcribed audio description could not be recognized as a valid food item',
      );
    }

    // Cache temporary pending data for 10 minutes (600 seconds)
    const cacheKey = `pending_meal:${authId}`;
    await this.redisService.set(cacheKey, mealData, 600);

    return {
      success: true,
      data: mealData,
    };
  } catch (error: any) {
    if (error instanceof BadRequestException) throw error;
    throw new InternalServerErrorException(
      `Failed to track meal from voice configuration: ${error.message}`,
    );
  }
}


  async trackFromImage(authId: string, filePath: string) {
    if (!filePath) {
      throw new BadRequestException('Image attachment path context missing');
    }

    try {
      const mealData =
        await this.openaiService.processImageToMealDataDirect(filePath);

      if (!mealData.isValidMeal) {
        throw new BadRequestException(
          'The uploaded food image could not be verified or recognized',
        );
      }

      // Cache temporary pending data for 10 minutes (600 seconds)
      const cacheKey = `pending_meal:${authId}`;
      await this.redisService.set(cacheKey, mealData, 600);

      return {
        success: true,
        data: mealData,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        `Failed to track meal from image recognition: ${error.message}`,
      );
    }
  }

  async confirmAndLogMeal(authId: string) {
    try {
      const cacheKey = `pending_meal:${authId}`;
      const cachedMealData = await this.redisService.get<any>(cacheKey);

      if (!cachedMealData) {
        throw new BadRequestException(
          'No recently parsed meal metrics found or temporary tracking context expired',
        );
      }

      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });

      if (!userProfile) {
        throw new NotFoundException(
          'User profile records missing from registry',
        );
      }

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const updatedLog = await this.prisma.userDailyHealthLog.upsert({
        where: {
          userProfileId_date: {
            userProfileId: userProfile.id,
            date: startOfToday,
          },
        },
        update: {
          calories: {
            increment: Math.round(cachedMealData.overall.totalCalories),
          },
          proteinGrams: {
            increment: Math.round(cachedMealData.overall.totalProtein),
          },
          carbsGrams: {
            increment: Math.round(cachedMealData.overall.totalCarbs),
          },
          fatGrams: { increment: Math.round(cachedMealData.overall.totalFat) },
        },
        create: {
          userProfileId: userProfile.id,
          date: startOfToday,
          calories: Math.round(cachedMealData.overall.totalCalories),
          proteinGrams: Math.round(cachedMealData.overall.totalProtein),
          carbsGrams: Math.round(cachedMealData.overall.totalCarbs),
          fatGrams: Math.round(cachedMealData.overall.totalFat),
        },
      });

      // Clear the temporary Redis session record clean
      await this.redisService.del(cacheKey);

      return {
        success: true,
        data: updatedLog,
      };
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        `Failed to persist meal metrics inside daily log registry: ${error.message}`,
      );
    }
  }

  async createOrUpdateDailyMetrics(authId: string, dto: LogDailyMetricsDto) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
      });

      if (!userProfile) {
        throw new NotFoundException('User profile records missing from registry');
      }

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const updatedLog = await this.prisma.userDailyHealthLog.upsert({
        where: {
          userProfileId_date: {
            userProfileId: userProfile.id,
            date: startOfToday,
          },
        },
        update: {
          waterGlasses: dto.waterGlasses,
          steps: dto.steps,
          sleepHours: dto.sleepHours,
          sleepMinutes: dto.sleepMinutes,
        },
        create: {
          userProfileId: userProfile.id,
          date: startOfToday,
          waterGlasses: dto.waterGlasses,
          steps: dto.steps,
          sleepHours: dto.sleepHours,
          sleepMinutes: dto.sleepMinutes,
          calories: 0,
          proteinGrams: 0,
          carbsGrams: 0,
          fatGrams: 0,
          healthScore: 0,
        },
      });

      return {
        success: true,
        data: updatedLog,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to update daily metrics tracking parameters: ${error.message}`,
      );
    }
  }
}
