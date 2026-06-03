import { Module } from '@nestjs/common';
import { ProviderSpecializationService } from './provider-specialization.service';
import { ProviderSpecializationController } from './provider-specialization.controller';

@Module({
  providers: [ProviderSpecializationService],
  controllers: [ProviderSpecializationController],
})
export class ProviderSpecializationModule {}
