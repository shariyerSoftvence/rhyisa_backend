import { Module } from '@nestjs/common';
import { UserProfileService } from './users.service';
import { UserProfileController } from './users.controller';
import { UploadFilesModule } from '../../common/upload-files/upload-files.module';

@Module({
  providers: [UserProfileService],
  controllers: [UserProfileController],
  imports: [UploadFilesModule]
})
export class UsersModule {}
