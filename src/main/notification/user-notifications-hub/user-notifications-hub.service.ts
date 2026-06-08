import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export class NotificationQueryDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class UserNotificationsHubService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllNotifications(userId: string, query: NotificationQueryDto) {
    try {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
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

      return {
        success: true,
        meta: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        data: flattenedNotifications,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to recover notification history feed: ${error.message}`,
      );
    }
  }

  async getSingleNotification(userId: string, id: string) {
    try {
      const userNotification = await this.prisma.userNotification.findFirst({
        where: { id, userId },
        include: { notification: true },
      });

      if (!userNotification) {
        throw new NotFoundException(
          'Target notification entry parameters matching criteria missing',
        );
      }

      return {
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