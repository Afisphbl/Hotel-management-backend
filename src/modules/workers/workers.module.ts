import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { Notification } from '../../database/entities/notification.entity';
import { AnalyticsSnapshot } from '../../database/entities/analytics-snapshot.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Booking } from '../../database/entities/booking.entity';
import { Hotel } from '../../database/entities/hotel.entity';

import { OutboxRelayProcessor } from './processors/outbox-relay.processor';
import { InvoicePdfProcessor } from './processors/invoice-pdf.processor';
import { AnalyticsSnapshotProcessor } from './processors/analytics-snapshot.processor';
import { NotificationProcessor } from './processors/notification.processor';

import { NotificationService } from './services/notification.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutboxEvent,
      Notification,
      AnalyticsSnapshot,
      Invoice,
      Booking,
      Hotel,
    ]),
    BullModule.registerQueue(
      { name: 'outbox-relay' },
      { name: 'invoice-pdf' },
      { name: 'analytics-snapshot' },
      { name: 'notifications' },
    ),
  ],
  providers: [
    OutboxRelayProcessor,
    InvoicePdfProcessor,
    AnalyticsSnapshotProcessor,
    NotificationProcessor,
    NotificationService,
    PdfGeneratorService,
    AnalyticsService,
  ],
  exports: [NotificationService, PdfGeneratorService, AnalyticsService],
})
export class WorkersModule {}
