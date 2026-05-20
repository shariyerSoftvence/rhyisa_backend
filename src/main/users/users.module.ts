import { Module } from '@nestjs/common';
import { UserProfileService } from './users.service';
import { UserProfileController } from './users.controller';

@Module({
  providers: [UserProfileService],
  controllers: [UserProfileController]
})
export class UsersModule {}
