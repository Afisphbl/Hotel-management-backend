import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import {
  OutboxEvent,
  OutboxStatus,
} from '../../../database/entities/outbox-event.entity';
import { NotificationService } from '../services/notification.service';

export interface OutboxHandlers {
  [eventType: string]: (payload: any) => Promise<void>;
}

@Processor('outbox-relay')
export class OutboxRelayProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxRelayProcessor.name);

  private handlers: OutboxHandlers;

  constructor(
    @InjectRepository(OutboxEvent)
    private outboxRepository: Repository<OutboxEvent>,
    private notificationService: NotificationService,
  ) {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers = {
      BOOKING_CREATED: async (payload) => {
        this.logger.log(`Handling BOOKING_CREATED: ${payload.bookingId}`);
      },
      BOOKING_CONFIRMED: async (payload) => {
        this.logger.log(`Handling BOOKING_CONFIRMED: ${payload.bookingId}`);
        await this.notificationService.send({
          userId: payload.guestId || 'system',
          type: 'booking_confirmed' as any,
          title: 'Booking Confirmed',
          body: `Your booking ${payload.bookingId} has been confirmed.`,
          data: { bookingId: payload.bookingId },
        });
      },
      BOOKING_CANCELLED: async (payload) => {
        this.logger.log(`Handling BOOKING_CANCELLED: ${payload.bookingId}`);
        await this.notificationService.send({
          userId: payload.guestId || 'system',
          type: 'booking_cancelled' as any,
          title: 'Booking Cancelled',
          body: `Booking ${payload.bookingId} was cancelled.`,
          data: { bookingId: payload.bookingId, reason: payload.reason },
        });
      },
    };
  }

  async process(job: Job<{ eventId?: string; batch?: boolean }>): Promise<any> {
    const { eventId } = job.data;

    if (eventId) {
      return this.processSingle(eventId);
    }

    return this.processBatch();
  }

  private async processSingle(eventId: string): Promise<void> {
    const event = await this.outboxRepository.findOneBy({ id: eventId });
    if (!event) {
      this.logger.warn(`Outbox event ${eventId} not found`);
      return;
    }
    await this.dispatch(event);
  }

  private async processBatch(): Promise<{ processed: number; failed: number }> {
    const batchSize = 50;
    const pending = await this.outboxRepository.find({
      where: { status: OutboxStatus.PENDING },
      take: batchSize,
      order: { createdAt: 'ASC' },
    });

    let processed = 0;
    let failed = 0;

    for (const event of pending) {
      try {
        await this.dispatch(event);
        processed++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to dispatch event ${event.id}: ${err.message}`,
        );
      }
    }

    if (pending.length > 0) {
      this.logger.log(
        `Outbox relay: ${processed} processed, ${failed} failed`,
      );
    }

    return { processed, failed };
  }

  private async dispatch(event: OutboxEvent): Promise<void> {
    const handler = this.handlers[event.type];
    if (!handler) {
      this.logger.warn(`No handler registered for event type: ${event.type}`);
      event.status = OutboxStatus.PROCESSED;
      event.error = null as any;
      await this.outboxRepository.save(event);
      return;
    }

    try {
      await handler(event.payload);
      event.status = OutboxStatus.PROCESSED;
      (event as any).error = null;
      await this.outboxRepository.save(event);
    } catch (err) {
      event.attempts += 1;
      event.error = err.message;

      if (event.attempts >= 5) {
        event.status = OutboxStatus.FAILED;
        this.logger.error(
          `Event ${event.id} failed after ${event.attempts} attempts`,
        );
      }

      await this.outboxRepository.save(event);
      throw err;
    }
  }
}
