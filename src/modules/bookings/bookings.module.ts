import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingService } from './pricing.service';
import { HoldExpiryProcessor } from './processors/hold-expiry.processor';
import { BookingReminderProcessor } from './processors/booking-reminder.processor';
import { Booking } from '../../database/entities/booking.entity';
import { BookingRoom } from '../../database/entities/booking-room.entity';
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
import { Notification } from '../../database/entities/notification.entity';
import { Hotel } from '../../database/entities/hotel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingRoom,
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
      Notification,
      Hotel,
    ]),
    BullModule.registerQueue(
      { name: 'hold-expiry' },
      { name: 'booking-reminders' },
    ),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, PricingService, HoldExpiryProcessor, BookingReminderProcessor],
  exports: [BookingsService],
})
export class BookingsModule implements OnApplicationBootstrap {
  constructor(@InjectQueue('booking-reminders') private remindersQueue: Queue) {}

  async onApplicationBootstrap() {
    const repeatableJobs = await this.remindersQueue.getRepeatableJobs();
    const existing = repeatableJobs.find((j) => j.name === 'daily-reminder');
    if (!existing) {
      await this.remindersQueue.add(
        'daily-reminder',
        {},
        {
          repeat: { pattern: '0 6 * * *' },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    }
  }
}
