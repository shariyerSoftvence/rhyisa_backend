import { Module } from '@nestjs/common';
import { ClientBookingService } from './services/client-booking.service';
import { ClientBookingController } from './controllers/client-booking.controller';
import { ClientBookingHistoryController } from './controllers/client-booking-history.controller';
import { ClientBookingHistoryService } from './services/client-booking-history.service';
import { ProviderBookingOperationsController } from './controllers/provider-booking-operations.controller';
import { ProviderBookingOperationsService } from './services/provider-booking-operations.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [
    ClientBookingService,
    ClientBookingHistoryService,
    ProviderBookingOperationsService,
  ],
  controllers: [
    ClientBookingController,
    ClientBookingHistoryController,
    ProviderBookingOperationsController,
  ],
})
export class ClientBookingModule {}
