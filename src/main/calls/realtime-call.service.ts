
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CallStatus } from '../../../generated/prisma/enums';



@Injectable()
export class RealTimeCallService {
  constructor(private prisma: PrismaService) {}

  async createCall(
    hostUserId: string,
    recipientUserId: string,
    title?: string,
  ) {
    return this.prisma.client.calling.create({
      data: {
        hostUserId,
        recipientUserId,
        title,
      },
    });
  }

  async markRinging(callId: string) {
    return this.prisma.client.calling.update({
      where: { id: callId },
      data: { status: CallStatus.RINING, startedAt: new Date() },
    });
  }

  async markActive(callId: string) {
    return this.prisma.client.calling.update({
      where: { id: callId },
      data: { status: CallStatus.ACTIVE, startedAt: new Date() },
    });
  }

  async markDeclined(callId: string) {
    return this.prisma.client.calling.update({
      where: { id: callId },
      data: { status: CallStatus.DECLINED, endedAt: new Date() },
    });
  }

  async markMissed(callId: string) {
    return this.prisma.client.calling.update({
      where: { id: callId },
      data: { status: CallStatus.MISSED, endedAt: new Date() },
    });
  }

  async endCall(callId: string) {
    return this.prisma.client.calling.update({
      where: { id: callId },
      data: { status: CallStatus.END, endedAt: new Date() },
    });
  }

  async getCallStatus(callId: string) {
    const call = await this.prisma.client.calling.findUnique({
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

    return call;
  }
}