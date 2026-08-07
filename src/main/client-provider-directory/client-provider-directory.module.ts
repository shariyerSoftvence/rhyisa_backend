import { Module } from '@nestjs/common';
import { ClientProviderDirectoryService } from './client-provider-directory.service';
import { ClientProviderDirectoryController } from './client-provider-directory.controller';

@Module({
  providers: [ClientProviderDirectoryService],
  controllers: [ClientProviderDirectoryController],
})
export class ClientProviderDirectoryModule {}
