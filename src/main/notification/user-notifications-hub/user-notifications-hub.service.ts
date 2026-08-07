import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

export class NotificationQueryDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class UserNotificationsHubService {
  private readonly CACHE_TTL = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async clearUserNotificationCaches(userId: string) {
    const client = this.redis.getClient();
    const keys = await client.keys(`notifications:user:${userId}:*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  async getAllNotifications(userId: string, query: NotificationQueryDto) {
    try {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const cacheKey = `notifications:user:${userId}:page_${page}_limit_${limit}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const skip = (page - 1) * limit;

      const [totalCount, userNotifications] = await this.prisma.$transaction([
        this.prisma.userNotification.count({ where: { userId } }),
        this.prisma.userNotification.findMany({
          where: { userId },
          include: { notification: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const flattenedNotifications = userNotifications.map((un) => ({
        id: un.id,
        type: un.notification.type,
        title: un.notification.title,
        message: un.notification.message,
        meta: un.notification.meta,
        read: un.read,
        createdAt: un.notification.createdAt,
      }));

      const result = {
        success: true,
        meta: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        data: flattenedNotifications,
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to recover notification history feed: ${error.message}`,
      );
    }
  }

  async getSingleNotification(userId: string, id: string) {
    try {
      const cacheKey = `notifications:id:${id}`;
      const cached = await this.redis.get<any>(cacheKey);
      if (cached) return cached;

      const userNotification = await this.prisma.userNotification.findFirst({
        where: { id, userId },
        include: { notification: true },
      });

      if (!userNotification) {
        throw new NotFoundException(
          'Target notification entry parameters matching criteria missing',
        );
      }

      const result = {
        success: true,
        data: {
          id: userNotification.id,
          type: userNotification.notification.type,
          title: userNotification.notification.title,
          message: userNotification.notification.message,
          meta: userNotification.notification.meta,
          read: userNotification.read,
          createdAt: userNotification.notification.createdAt,
        },
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to retrieve specific notification record context: ${error.message}`,
      );
    }
  }

  async markAsRead(userId: string, id: string) {
    try {
      const targetRecord = await this.prisma.userNotification.findFirst({
        where: { id, userId },
      });

      if (!targetRecord) {
        throw new NotFoundException(
          'Target validation index token mismatched or context data missing',
        );
      }

      const updatedRecord = await this.prisma.userNotification.update({
        where: { id },
        data: { read: true },
        include: { notification: true },
      });

      await this.redis.del(`notifications:id:${id}`);
      await this.clearUserNotificationCaches(userId);

      return {
        success: true,
        data: {
          id: updatedRecord.id,
          read: updatedRecord.read,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to update execution read state loop properties: ${error.message}`,
      );
    }
  }

  async markAllAsRead(userId: string) {
    try {
      const updateSummary = await this.prisma.userNotification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });

      await this.clearUserNotificationCaches(userId);

      return {
        success: true,
        count: updateSummary.count,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to execute bulk verification update parameters: ${error.message}`,
      );
    }
  }
}
