import { Module } from '@nestjs/common';
import { ProviderProfileController } from './provider-profile.controller';
import { ProviderProfileService } from './provider-profile.service';
import { UploadFilesModule } from '../../common/upload-files/upload-files.module';

@Module({
  controllers: [ProviderProfileController],
  providers: [ProviderProfileService],
  imports: [UploadFilesModule],
})
export class ProviderProfileModule {}
