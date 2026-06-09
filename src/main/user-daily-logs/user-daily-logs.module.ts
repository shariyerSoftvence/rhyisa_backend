import { Module } from '@nestjs/common';
import { UserDailyLogsService } from './user-daily-logs.service';
import { UserDailyLogsController } from './user-daily-logs.controller';
import { OpenaiService } from '../openai/openai.service';

@Module({
  providers: [UserDailyLogsService, OpenaiService],
  controllers: [UserDailyLogsController],
})
export class UserDailyLogsModule {}
