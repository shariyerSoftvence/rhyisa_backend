import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CallStatus } from '../../../generated/prisma/enums';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class RealTimeCallService {
  private readonly CACHE_PREFIX = 'call:status:';
  private readonly CACHE_TTL = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async createCall(
    hostUserId: string,
    recipientUserId: string,
    title?: string,
  ) {
    return this.prisma.calling.create({
      data: {
        hostUserId,
        recipientUserId,
        title,
      },
    });
  }

  async markRinging(callId: string) {
    const updated = await this.prisma.calling.update({
      where: { id: callId },
      data: { status: CallStatus.RINING, startedAt: new Date() },
    });
    await this.redis.del(`${this.CACHE_PREFIX}${callId}`);
    return updated;
  }

  async markActive(callId: string) {
    const updated = await this.prisma.calling.update({
      where: { id: callId },
      data: { status: CallStatus.ACTIVE, startedAt: new Date() },
    });
    await this.redis.del(`${this.CACHE_PREFIX}${callId}`);
    return updated;
  }

  async markDeclined(callId: string) {
    const updated = await this.prisma.calling.update({
      where: { id: callId },
      data: { status: CallStatus.DECLINED, endedAt: new Date() },
    });
    await this.redis.del(`${this.CACHE_PREFIX}${callId}`);
    return updated;
  }

  async markMissed(callId: string) {
    const updated = await this.prisma.calling.update({
      where: { id: callId },
      data: { status: CallStatus.MISSED, endedAt: new Date() },
    });
    await this.redis.del(`${this.CACHE_PREFIX}${callId}`);
    return updated;
  }

  async endCall(callId: string) {
    const updated = await this.prisma.calling.update({
      where: { id: callId },
      data: { status: CallStatus.END, endedAt: new Date() },
    });
    await this.redis.del(`${this.CACHE_PREFIX}${callId}`);
    return updated;
  }

  async getCallStatus(callId: string) {
    const cacheKey = `${this.CACHE_PREFIX}${callId}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const call = await this.prisma.calling.findUnique({
      where: { id: callId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        hostUserId: true,
        recipientUserId: true,
        title: true,
      },
    });

    if (!call) {
      throw new Error('Call not found');
    }

    await this.redis.set(cacheKey, call, this.CACHE_TTL);
    return call;
  }
}
