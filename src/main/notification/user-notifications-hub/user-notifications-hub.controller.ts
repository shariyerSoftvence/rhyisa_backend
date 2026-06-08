import { Controller, Get, Param, Patch, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationQueryDto, UserNotificationsHubService } from './user-notifications-hub.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';


@ApiTags('Realtime Centralized Notification Infrastructure Ecosystem')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserNotificationsHubController {
  constructor(private readonly notificationHubService: UserNotificationsHubService) {}

  @Get()
  @ApiOperation({ summary: 'Pull system logs data array containing user history messages' })
  async getAllNotifications(@Req() req: any, @Query() query: NotificationQueryDto) {
    return this.notificationHubService.getAllNotifications(req.user.id, query);
  }

  @Get(':notifId')
  @ApiOperation({ summary: 'Isolate structural properties belonging to a specific item log identity' })
  async getSingleNotification(@Req() req: any, @Param('notifId') notifId: string) {
    return this.notificationHubService.getSingleNotification(req.user.id, notifId);
  }

  @Patch('mark-all-read')
  @ApiOperation({ summary: 'Initialize clear parameter loop across all assigned user rows' })
  async markAllAsRead(@Req() req: any) {
    return this.notificationHubService.markAllAsRead(req.user.id);
  }

  @Patch(':notifId/read')
  @ApiOperation({ summary: 'Update state variables tracking read metadata parameters for a record row' })
  async markAsRead(@Req() req: any, @Param('notifId') notifId: string) {
    return this.notificationHubService.markAsRead(req.user.id, notifId);
  }
}