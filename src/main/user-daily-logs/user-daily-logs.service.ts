import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenaiService } from '../openai/openai.service';

@Injectable()
export class UserDailyLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenaiService,
  ) {}

  async getTodayProgressWithGoal(authId: string) {
    try {
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { authId },
        include: { healthGoal: true },
      });

      if (!userProfile) {
        throw new NotFoundException(
          'User profile records missing from registry',
        );
      }

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const dailyLog = await this.prisma.userDailyHealthLog.findUnique({
        where: {
          userProfileId_date: {
            userProfileId: userProfile.id,
            date: startOfToday,
          },
        },
      });

      const goals = userProfile.healthGoal || {
        calorieGoal: 2000,
        waterGoal: 8,
        proteinGoal: 120,
        carbsGoal: 250,
        fatGoal: 65,
        stepsGoal: 6000,
        sleepGoalHours: 8,
      };

      const progress = dailyLog || {
        calories: 0,
        waterGlasses: 0,
        proteinGrams: 0,
        carbsGrams: 0,
        fatGrams: 0,
        steps: 0,
        sleepHours: 0,
        healthScore: 0,
      };

      const nutritionScore =
        Math.min(
          100,
          Math.round(
            ((progress.proteinGrams + progress.carbsGrams + progress.fatGrams) /
              (goals.proteinGoal + goals.carbsGoal + goals.fatGoal || 1)) *
              100,
          ),
        ) || 0;
      const hydrationScore = Math.min(
        100,
        Math.round((progress.waterGlasses / (goals.waterGoal || 1)) * 100),
      );
      const recoveryScore = Math.min(
        100,
        Math.round((progress.sleepHours / (goals.sleepGoalHours || 1)) * 100),
      );
      const consistencyScore = Math.min(
        100,
        Math.round((progress.steps / (goals.stepsGoal || 1)) * 100),
      );

      // Calculate aggregate systemic evaluation matrix score values
      const computedOverallHealthScore = Math.round(
        (nutritionScore + hydrationScore + recoveryScore + consistencyScore) /
          4,
      );

      // Call AI generation downstream runtime worker
      const aiRecommendations =
        await this.openaiService.generateDailyRecommendations({
          goals: {
            calorieGoal: goals.calorieGoal,
            waterGoal: goals.waterGoal,
            proteinGoal: goals.proteinGoal,
            carbsGoal: goals.carbsGoal,
            fatGoal: goals.fatGoal,
            stepsGoal: goals.stepsGoal,
            sleepGoalHours: goals.sleepGoalHours,
          },
          progress: {
            calories: progress.calories,
            waterGlasses: progress.waterGlasses,
            proteinGrams: progress.proteinGrams,
            carbsGrams: progress.carbsGrams,
            fatGrams: progress.fatGrams,
            steps: progress.steps,
            sleepHours: progress.sleepHours,
          },
        });

      return {
        success: true,
        data: {
          overallHealthScore:
            progress.healthScore || computedOverallHealthScore,
          wellnessIntelligence: {
            nutrition: {
              score: nutritionScore,
              status: nutritionScore >= 80 ? 'Good' : 'Needs Work',
            },
            hydration: {
              score: hydrationScore,
              status: hydrationScore >= 80 ? 'Good' : 'Needs Work',
            },
            recovery: {
              score: recoveryScore,
              status: recoveryScore >= 80 ? 'Good' : 'Needs Work',
            },
            consistency: {
              score: consistencyScore,
              status: consistencyScore >= 80 ? 'Good' : 'Needs Work',
            },
          },
          aiRecommendations: aiRecommendations.recommendations,
          currentProgress: progress,
          assignedGoals: goals,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to extract today's metric indices validation loops: ${error.message}`,
      );
    }
  }

async get30DaysHealthScoreHistory(authId: string) {
try {
const userProfile = await this.prisma.userProfile.findUnique({
    where: { authId },
});

if (!userProfile) {
    throw new NotFoundException(
    'User profile records missing from registry',
    );
}

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

const logs = await this.prisma.userDailyHealthLog.findMany({
    where: {
    userProfileId: userProfile.id,
    date: { gte: thirtyDaysAgo },
    },
    select: {
    date: true,
    healthScore: true,
    calories: true,
    waterGlasses: true,
    steps: true,
    sleepHours: true,
    },
    orderBy: { date: 'asc' },
});

// Pass the retrieved timeline history down to the OpenAI completion loop worker
const aiIntelligenceAnalysis = await this.openaiService.generateHistoricalIntelligenceAnalysis({
    logs,
});

return {
    success: true,
    data: {
    chartTimelineLogs: logs,
    wellnessIntelligenceAnalysis: aiIntelligenceAnalysis,
    },
};
} catch (error: any) {
if (error instanceof NotFoundException) throw error;
throw new InternalServerErrorException(
    `Failed to compile multi-day analytical historical chart trends: ${error.message}`,
);
}
}
}
