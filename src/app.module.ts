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
import { InsuranceModule } from './main/admin/insurance/insurance.module';
import { SeedService } from './common/seed/seedService';
import { UserManagementModule } from './main/admin/user-management/user-management.module';
import { UsersModule } from './main/users/users.module';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    PrismaModule,
    AuthModule,
    MailModule,
    OpenaiModule,
    RealTimeCallModule,
    InsuranceModule,
    UserManagementModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
