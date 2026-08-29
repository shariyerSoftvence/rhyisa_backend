import { Module } from '@nestjs/common';
import { UserProfileService } from './users.service';
import { UserProfileController } from './users.controller';
import { UploadFilesModule } from '../../common/upload-files/upload-files.module';
import { OpenaiService } from '../openai/openai.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [UserProfileService, OpenaiService],
  controllers: [UserProfileController],
  imports: [UploadFilesModule, AuthModule],
})
export class UsersModule {}
