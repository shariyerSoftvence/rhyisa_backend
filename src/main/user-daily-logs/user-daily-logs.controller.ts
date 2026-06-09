import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserDailyLogsService } from './user-daily-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../../generated/prisma/enums';

@ApiTags('User Analytics Dashboard & Progress Tracking Engine')
@Controller('user/health-metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.USER)
@ApiBearerAuth()
export class UserDailyLogsController {
  constructor(private readonly dailyLogsService: UserDailyLogsService) {}

  @Get('today-progress')
  @ApiOperation({
    summary:
      'Pull user health goals mixed against realtime today tracking metrics alongside AI engine suggestions',
  })
  async todayProgressWithGoal(@Req() req: any) {
    return this.dailyLogsService.getTodayProgressWithGoal(req.user.id);
  }

  @Get('health-score')
  @ApiOperation({
    summary:
      'Compile structured historical system record data parameters tracking 30-day index curves',
  })
  async get30DaysHistory(@Req() req: any) {
    return this.dailyLogsService.get30DaysHealthScoreHistory(req.user.id);
  }
}
