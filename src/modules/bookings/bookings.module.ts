import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingService } from './pricing.service';
import { HoldExpiryProcessor } from './processors/hold-expiry.processor';
import { Booking } from '../../database/entities/booking.entity';
import { RoomNight } from '../../database/entities/room-night.entity';
import { RoomType } from '../../database/entities/room-type.entity';
import { Room } from '../../database/entities/room.entity';
import { Guest } from '../../database/entities/guest.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SeasonalRate } from '../../database/entities/seasonal-rate.entity';
import { Promotion } from '../../database/entities/promotion.entity';
import { PriceOverride } from '../../database/entities/price-override.entity';
import { RatePlan } from '../../database/entities/rate-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      RoomNight,
      RoomType,
      Room,
      Guest,
      OutboxEvent,
      AuditLog,
      SeasonalRate,
      Promotion,
      PriceOverride,
      RatePlan,
    ]),
    BullModule.registerQueue({
      name: 'hold-expiry',
    }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, PricingService, HoldExpiryProcessor],
  exports: [BookingsService],
})
export class BookingsModule {}
