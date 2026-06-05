import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingCronService } from './services/billing-cron.service';
import { BillingService } from './services/billing.service';
import { BillingOwnerController } from './controllers/billing-owner.controller';
import { BillingPlatformController } from './controllers/billing-platform.controller';
import { BillingWebhookController } from './controllers/billing-webhook.controller';
import { Hotel } from '../../database/entities/hotel.entity';
import { SubscriptionPayment } from '../../database/entities/global/subscription-payment.entity';
import { User } from '../../database/entities/user.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { PlatformUser } from '../../database/entities/global/platform-user.entity';
import { PublicBookingModule } from '../public-booking/public-booking.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Hotel, SubscriptionPayment, User, HotelUserAccess, PlatformUser]),
    PublicBookingModule,
    WorkersModule,
  ],
  controllers: [
    BillingOwnerController,
    BillingPlatformController,
    BillingWebhookController,
  ],
  providers: [BillingCronService, BillingService],
  exports: [BillingCronService, BillingService],
})
export class BillingModule {}
