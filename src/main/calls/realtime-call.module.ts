import { Module } from '@nestjs/common';
import { RealTimeCallGateway } from './realtime-call.gateway';
import { RealTimeCallService } from './realtime-call.service';
import { RealTimeCallController } from './realtime-call.controller';
import { SocketAuthMiddleware } from '../../common/middleware/socket.auth.middleware';

@Module({
  controllers: [RealTimeCallController],
  providers: [RealTimeCallGateway, RealTimeCallService, SocketAuthMiddleware],
  exports: [RealTimeCallService, RealTimeCallGateway],
})
export class RealTimeCallModule {}
