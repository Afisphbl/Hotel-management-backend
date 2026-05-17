import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BookingsService } from './bookings.service';
import { PricingService } from './pricing.service';
import { HoldExpiryProcessor } from './processors/hold-expiry.processor';
import { Booking } from '../../database/entities/booking.entity';
import { RoomNight } from '../../database/entities/room-night.entity';
import { RoomType } from '../../database/entities/room-type.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, RoomNight, RoomType, OutboxEvent]),
    BullModule.registerQueue({
      name: 'hold-expiry',
    }),
  ],
  providers: [BookingsService, PricingService, HoldExpiryProcessor],
  exports: [BookingsService],
})
export class BookingsModule {}
