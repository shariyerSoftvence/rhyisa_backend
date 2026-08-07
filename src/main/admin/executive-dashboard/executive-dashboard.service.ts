import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  PaymentStatus,
  RoleType,
  UserStatus,
} from '../../../../generated/prisma/enums';

@Injectable()
export class ExecutiveDashboardService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly OVERVIEW_CACHE_KEY = 'admin:dashboard:overview';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async invalidateOverviewCache() {
    try {
      await this.redis.del(this.OVERVIEW_CACHE_KEY);
    } catch {
      // ignore redis errors silently
    }
  }

  private calculateGrowthPercentage(
    todayCount: number,
    prevCount: number,
  ): number {
    if (prevCount === 0) {
      return todayCount > 0 ? 100 : 0;
    }
    const growth = ((todayCount - prevCount) / prevCount) * 100;
    return Number(growth.toFixed(2));
  }

  async getOverviewData() {
    try {
      const cached = await this.redis.get<any>(this.OVERVIEW_CACHE_KEY);
      if (cached) {
        return cached;
      }

      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      const startOfYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        0,
        0,
        0,
        0,
      );
      const endOfYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        23,
        59,
        59,
        999,
      );

      const [
        totalActiveUsers,
        activeUsersToday,
        activeUsersYesterday,
        totalActiveProviders,
        activeProvidersToday,
        activeProvidersYesterday,
        newUsersTodayCount,
        newUsersYesterdayCount,
        totalUsersCount,
        convertedUsersCount,
        totalTickets,
        ticketsToday,
        ticketsYesterday,
      ] = await Promise.all([
        // 1. Total active users
        this.prisma.auth.count({
          where: { role: RoleType.USER, status: UserStatus.ACTIVE },
        }),
        // Active users created today
        this.prisma.auth.count({
          where: {
            role: RoleType.USER,
            status: UserStatus.ACTIVE,
            createdAt: { gte: startOfToday },
          },
        }),
        // Active users created yesterday
        this.prisma.auth.count({
          where: {
            role: RoleType.USER,
            status: UserStatus.ACTIVE,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        // 2. Active providers
        this.prisma.auth.count({
          where: { role: RoleType.PROVIDER, status: UserStatus.ACTIVE },
        }),
        // Active providers created today
        this.prisma.auth.count({
          where: {
            role: RoleType.PROVIDER,
            status: UserStatus.ACTIVE,
            createdAt: { gte: startOfToday },
          },
        }),
        // Active providers created yesterday
        this.prisma.auth.count({
          where: {
            role: RoleType.PROVIDER,
            status: UserStatus.ACTIVE,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        // 3. New users registered today & yesterday
        this.prisma.auth.count({
          where: { role: RoleType.USER, createdAt: { gte: startOfToday } },
        }),
        this.prisma.auth.count({
          where: {
            role: RoleType.USER,
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
        }),

        // 4. Conversions
        this.prisma.auth.count({
          where: { role: RoleType.USER },
        }),
        this.prisma.auth.count({
          where: {
            role: RoleType.USER,
            OR: [
              { userProfile: { subscriptionType: 'PREMIUM' } },
              { userProfile: { subscribed: { isNot: null } } },
              {
                userProfile: {
                  bookings: {
                    some: { payment: { status: PaymentStatus.SUCCESSFUL } },
                  },
                },
              },
            ],
          },
        }),

        // 5. Total Tickets
        this.prisma.ticket.count(),
        this.prisma.ticket.count({
          where: { createdAt: { gte: startOfToday } },
        }),
        this.prisma.ticket.count({
          where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday } },
        }),
      ]);

      // Calculations
      const activeUsersGrowthPercentage = this.calculateGrowthPercentage(
        activeUsersToday,
        activeUsersYesterday,
      );

      const activeProvidersGrowthPercentage = this.calculateGrowthPercentage(
        activeProvidersToday,
        activeProvidersYesterday,
      );

      const newUsersGrowthRate = this.calculateGrowthPercentage(
        newUsersTodayCount,
        newUsersYesterdayCount,
      );

      const nonConvertedUsersCount = Math.max(
        0,
        totalUsersCount - convertedUsersCount,
      );
      const conversionPercentage =
        totalUsersCount > 0
          ? Number(((convertedUsersCount / totalUsersCount) * 100).toFixed(2))
          : 0;
      const nonConversionPercentage =
        totalUsersCount > 0
          ? Number(
              ((nonConvertedUsersCount / totalUsersCount) * 100).toFixed(2),
            )
          : 0;

      const ticketsGrowthPercentage = this.calculateGrowthPercentage(
        ticketsToday,
        ticketsYesterday,
      );

      const result = {
        message: 'Executive Dashboard Overview retrieved successfully',
        data: {
          activeUsers: {
            totalCount: totalActiveUsers,
            todayCount: activeUsersToday,
            yesterdayCount: activeUsersYesterday,
            growthPercentage: activeUsersGrowthPercentage,
          },
          activeProviders: {
            totalCount: totalActiveProviders,
            todayCount: activeProvidersToday,
            yesterdayCount: activeProvidersYesterday,
            growthPercentage: activeProvidersGrowthPercentage,
          },
          newUsers: {
            todayCount: newUsersTodayCount,
            yesterdayCount: newUsersYesterdayCount,
            growthRatePercentage: newUsersGrowthRate,
          },
          conversions: {
            totalUsersCount,
            convertedUsersCount,
            nonConvertedUsersCount,
            conversionPercentage,
            nonConversionPercentage,
          },
          tickets: {
            totalCount: totalTickets,
            todayCount: ticketsToday,
            yesterdayCount: ticketsYesterday,
            growthPercentage: ticketsGrowthPercentage,
          },
        },
      };

      await this.redis.set(this.OVERVIEW_CACHE_KEY, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch executive dashboard overview: ${(error as any).message}`,
      );
    }
  }

  async getMonthlyRevenueAndUserGrowth(year?: number) {
    try {
      const targetYear = year || new Date().getFullYear();
      const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

      const [subscriptionPurchases, payments, registeredUsers] =
        await Promise.all([
          this.prisma.subscriptionPurchase.findMany({
            where: {
              createdAt: { gte: startOfYear, lte: endOfYear },
            },
            select: {
              amountPaid: true,
              createdAt: true,
            },
          }),
          this.prisma.payment.findMany({
            where: {
              status: PaymentStatus.SUCCESSFUL,
              createdAt: { gte: startOfYear, lte: endOfYear },
            },
            select: {
              totalAmount: true,
              platformFee: true,
              createdAt: true,
            },
          }),
          this.prisma.auth.findMany({
            where: {
              createdAt: { gte: startOfYear, lte: endOfYear },
            },
            select: {
              role: true,
              createdAt: true,
            },
          }),
        ]);

      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      const monthlyBreakdown = monthNames.map((name, index) => {
        const monthNum = index + 1;

        // Subscription revenue for this month
        const subRev = subscriptionPurchases
          .filter((sp) => sp.createdAt.getMonth() === index)
          .reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);

        // Booking revenue
        const bookingFeeRev = payments
          .filter((p) => p.createdAt.getMonth() === index)
          .reduce((acc, curr) => acc + (curr.platformFee || 0), 0);

        const bookingTotalRev = payments
          .filter((p) => p.createdAt.getMonth() === index)
          .reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        const totalRev = Number((subRev + bookingFeeRev).toFixed(2));

        // User Growth
        const newUsers = registeredUsers.filter(
          (u) => u.role === RoleType.USER && u.createdAt.getMonth() === index,
        ).length;

        const newProviders = registeredUsers.filter(
          (u) =>
            u.role === RoleType.PROVIDER && u.createdAt.getMonth() === index,
        ).length;

        const totalNewRegistrations = newUsers + newProviders;

        return {
          month: monthNum,
          monthName: name,
          revenue: {
            subscriptionRevenue: Number(subRev.toFixed(2)),
            bookingPlatformFeeRevenue: Number(bookingFeeRev.toFixed(2)),
            bookingTotalVolume: Number(bookingTotalRev.toFixed(2)),
            totalRevenue: totalRev,
          },
          userGrowth: {
            newUsers,
            newProviders,
            totalNewRegistrations,
          },
        };
      });

      const totalYearlyRevenue = Number(
        monthlyBreakdown
          .reduce((acc, curr) => acc + curr.revenue.totalRevenue, 0)
          .toFixed(2),
      );

      const totalYearlyNewUsers = monthlyBreakdown.reduce(
        (acc, curr) => acc + curr.userGrowth.newUsers,
        0,
      );

      const totalYearlyNewProviders = monthlyBreakdown.reduce(
        (acc, curr) => acc + curr.userGrowth.newProviders,
        0,
      );

      const currentMonthIndex =
        targetYear === new Date().getFullYear() ? new Date().getMonth() : 11;
      const prevMonthIndex = currentMonthIndex > 0 ? currentMonthIndex - 1 : 0;

      const currentMonthRev =
        monthlyBreakdown[currentMonthIndex]?.revenue.totalRevenue || 0;
      const prevMonthRev =
        currentMonthIndex > 0
          ? monthlyBreakdown[prevMonthIndex]?.revenue.totalRevenue || 0
          : 0;

      const momRevenueGrowthPercentage = this.calculateGrowthPercentage(
        currentMonthRev,
        prevMonthRev,
      );

      const currentMonthUsers =
        monthlyBreakdown[currentMonthIndex]?.userGrowth.totalNewRegistrations ||
        0;
      const prevMonthUsers =
        currentMonthIndex > 0
          ? monthlyBreakdown[prevMonthIndex]?.userGrowth
              .totalNewRegistrations || 0
          : 0;

      const momUserGrowthPercentage = this.calculateGrowthPercentage(
        currentMonthUsers,
        prevMonthUsers,
      );

      return {
        message:
          'Monthly Revenue Overview & User Growth retrieved successfully',
        data: {
          year: targetYear,
          revenueSummary: {
            totalYearlyRevenue,
            currentMonthRevenue: currentMonthRev,
            previousMonthRevenue: prevMonthRev,
            momRevenueGrowthPercentage,
          },
          userGrowthSummary: {
            totalYearlyNewUsers,
            totalYearlyNewProviders,
            currentMonthNewRegistrations: currentMonthUsers,
            previousMonthNewRegistrations: prevMonthUsers,
            momUserGrowthPercentage,
          },
          monthlyBreakdown,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to fetch monthly revenue overview and user growth: ${(error as any).message}`,
      );
    }
  }
}
