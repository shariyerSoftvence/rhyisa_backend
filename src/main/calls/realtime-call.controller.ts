import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RealTimeCallService } from './realtime-call.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('realtime-call')
export class RealTimeCallController {
  constructor(private readonly callService: RealTimeCallService) {}

  @Get(':callId/status')
  async getCallStatus(@Param('callId') callId: string) {
    return this.callService.getCallStatus(callId);
  }
}
