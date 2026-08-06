import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './main/auth/auth.module';
import { MailModule } from './common/mail/mail.module';
import { OpenaiModule } from './main/openai/openai.module';
import { RealTimeCallModule } from './main/calls/realtime-call.module';
import { SeedService } from './common/seed/seedService';
import { UserManagementModule } from './main/admin/user-management/user-management.module';
import { UsersModule } from './main/users/users.module';
import { PrivateMessageModule } from './main/chats/chats.module';
import { ProviderSpecializationModule } from './main/admin/provider-specialization/provider-specialization.module';
import { ProviderProfileModule } from './main/provider-profile/provider-profile.module';
import { CommissionModule } from './main/admin/commission/commission.module';
import { UploadFilesModule } from './common/upload-files/upload-files.module';
import { StripeWebhooksModule } from './stripe-webhooks/stripe-webhooks.module';
import { ProviderServiceManagementModule } from './main/provider-service-management/provider-service-management.module';
import { TrackMealModule } from './main/track-meal/track-meal.module';
import { ClientProviderDirectoryModule } from './main/client-provider-directory/client-provider-directory.module';
import { ClientBookingModule } from './main/client-booking/client-booking.module';
import { FeedbackReviewsModule } from './main/feedback-reviews/feedback-reviews.module';
import { NotificationModule } from './main/notification/notification.module';
import { UserDailyLogsModule } from './main/user-daily-logs/user-daily-logs.module';
import { SubscriptionModule } from './main/subscription/subscription.module';
import { ExecutiveDashboardModule } from './main/admin/executive-dashboard/executive-dashboard.module';
import { TicketManagementModule } from './main/admin/ticket-management/ticket-management.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CommissionModule,
    UserManagementModule,
    ProviderSpecializationModule,
    ExecutiveDashboardModule,
    TicketManagementModule,
    RedisModule,
    PrismaModule,
    MailModule,
    OpenaiModule,
    RealTimeCallModule,
    UsersModule,
    PrivateMessageModule,
    ProviderProfileModule,
    UploadFilesModule,
    StripeWebhooksModule,
    ProviderServiceManagementModule,
    TrackMealModule,
    ClientProviderDirectoryModule,
    ClientBookingModule,
    FeedbackReviewsModule,
    UserDailyLogsModule,
    NotificationModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule { }
