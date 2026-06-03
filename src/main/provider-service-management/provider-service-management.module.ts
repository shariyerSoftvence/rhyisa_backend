import { Module } from '@nestjs/common';
import { ProviderServiceManagementService } from './provider-service-management.service';
import { ProviderServiceManagementController } from './provider-service-management.controller';

@Module({
  providers: [ProviderServiceManagementService],
  controllers: [ProviderServiceManagementController],
})
export class ProviderServiceManagementModule {}
