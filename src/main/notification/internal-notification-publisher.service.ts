import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { RoleType } from '../../../generated/prisma/enums';
import { RedisService } from '../../common/redis/redis.service';


export interface CreateNotificationPayload {
  type: string;
  title: string;
  message: string;
  meta: Record<string, any>;
  recipientAuthIds?: string[]; // Leaving empty automatically triggers broadcast alerts to ADMIN channels
}

@Injectable()
export class InternalNotificationPublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly redis: RedisService,
  ) {}

  async publishNotification(payload: CreateNotificationPayload) {
    try {
      let targets: string[] = payload.recipientAuthIds || [];

      // Determine targets if no explicit recipients are provided
      if (targets.length === 0) {
        const adminAccounts = await this.prisma.auth.findMany({
          where: { role: RoleType.ADMIN },
          select: { id: true },
        });
        targets = adminAccounts.map((admin) => admin.id);
      }

      if (targets.length === 0) return;

      // Persist centralized infrastructure message log entries
      const savedNotification = await this.prisma.notification.create({
        data: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          meta: payload.meta,
        },
      });

      // Construct relation maps across all targeted identities safely
      const relationalLinks = targets.map((userId) => ({
        userId,
        notificationId: savedNotification.id,
        read: false,
      }));

      await this.prisma.userNotification.createMany({
        data: relationalLinks,
        skipDuplicates: true,
      });

      // Clear cache for targeted users
      const redisClient = this.redis.getClient();
      for (const userId of targets) {
        const keys = await redisClient.keys(`notifications:user:${userId}:*`);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }

      // Push transactional parameters cleanly downstream over channels
      const eventPayload = {
        id: savedNotification.id,
        type: savedNotification.type,
        title: savedNotification.title,
        message: savedNotification.message,
        meta: savedNotification.meta,
        createdAt: savedNotification.createdAt,
        read: false,
      };

      if (!payload.recipientAuthIds || payload.recipientAuthIds.length === 0) {
        this.gateway.sendNotificationToAdmins(eventPayload);
      } else {
        targets.forEach((userId) => {
          this.gateway.sendNotificationToUser(userId, eventPayload);
        });
      }

      return savedNotification;
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to distribute reusable transactional communication parameters: ${error.message}`,
      );
    }
  }
}