import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, LessThan } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import {
  OutboxEvent,
  OutboxStatus,
} from '../../../database/entities/outbox-event.entity';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';
import { Payment, PaymentMethod, PaymentStatus } from '../../../database/entities/payment.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { Hotel } from '../../../database/entities/hotel.entity';
import { NotificationService } from '../services/notification.service';

export interface OutboxHandlers {
  [eventType: string]: (payload: any) => Promise<void>;
}

@Processor('outbox-relay')
export class OutboxRelayProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxRelayProcessor.name);

  private handlers: OutboxHandlers;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(OutboxEvent)
    private outboxRepository: Repository<OutboxEvent>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private notificationService: NotificationService,
  ) {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers = {
      BOOKING_CREATED: async (payload) => {
        console.log(`[BOOKING_CREATED Handler] Starting for booking ${payload.bookingId}, totalPrice: ${payload.totalPrice}, hotelId: ${payload.hotelId}`);
        try {
          console.log(`[BOOKING_CREATED Handler] Checking for existing invoice, bookingId: ${payload.bookingId}`);
          const existing = await this.invoiceRepository.findOneBy({ bookingId: payload.bookingId });
          if (existing) {
            console.log(`[BOOKING_CREATED Handler] Invoice already exists: ${existing.id}`);
            this.logger.log(`Invoice already exists for booking ${payload.bookingId}`);
            return;
          }

          const invoice = this.invoiceRepository.create({
            bookingId: payload.bookingId,
            amount: payload.totalPrice ?? 0,
            status: InvoiceStatus.DRAFT,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          });

          const hotel = await this.hotelRepository.findOneBy({ id: payload.hotelId });
          const schema = hotel?.schemaName?.replace(/[^a-zA-Z0-9_]/g, '') ?? 'public';
          console.log(`[BOOKING_CREATED Handler] Saving invoice in tenant schema: ${schema}`);

          const qr = this.dataSource.createQueryRunner();
          await qr.connect();
          try {
            await qr.query(`SET search_path TO "${schema}", global, public`);
            const savedInvoice = await qr.manager.save(invoice);
            const payment = qr.manager.create(Payment, {
              invoiceId: savedInvoice.id,
              bookingId: payload.bookingId,
              amount: payload.totalPrice ?? 0,
              fee: 0,
              netAmount: payload.totalPrice ?? 0,
              currency: 'ETB',
              method: PaymentMethod.CASH,
              status: PaymentStatus.PENDING,
              description: `Auto-created payment for booking ${payload.bookingId}`,
            });
            const savedPayment = await qr.manager.save(payment);
            console.log(`[BOOKING_CREATED Handler] Invoice ${savedInvoice.id} + Payment ${savedPayment.id} created`);
            this.logger.log(`Invoice ${savedInvoice.id} and Payment ${savedPayment.id} created for booking ${payload.bookingId}`);
          } finally {
            await qr.release();
          }
        } catch (err) {
          console.error(`[BOOKING_CREATED Handler] ERROR:`, err.message, err.stack);
          this.logger.error(`Failed to create invoice for booking ${payload.bookingId}: ${err.message}`);
          throw err;
        }
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
    console.log(`[OutboxRelayProcessor] process() called, eventId: ${eventId}, jobId: ${job.id}`);

    if (eventId) {
      return this.processSingle(eventId);
    }

    return this.processBatch();
  }

  private async processSingle(eventId: string): Promise<void> {
    console.log(`[OutboxRelayProcessor] processSingle() looking for event ${eventId}`);
    const event = await this.outboxRepository.findOneBy({ id: eventId });
    if (!event) {
      console.log(`[OutboxRelayProcessor] Event ${eventId} NOT FOUND in database`);
      this.logger.warn(`Outbox event ${eventId} not found`);
      return;
    }
    console.log(`[OutboxRelayProcessor] Found event ${eventId}, type: ${event.type}, status: ${event.status}`);
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
      this.logger.log(`Outbox relay: ${processed} processed, ${failed} failed`);
    }

    return { processed, failed };
  }

  private async dispatch(event: OutboxEvent): Promise<void> {
    const handler = this.handlers[event.type];
    console.log(`[OutboxRelayProcessor] dispatch() for event ${event.id}, type: ${event.type}, hasHandler: ${!!handler}`);

    if (!handler) {
      this.logger.warn(`No handler registered for event type: ${event.type}`);
      event.status = OutboxStatus.PROCESSED;
      event.error = null as any;
      await this.outboxRepository.save(event);
      return;
    }

    try {
      await handler(event.payload);
      console.log(`[OutboxRelayProcessor] Handler completed successfully for event ${event.id}`);
      event.status = OutboxStatus.PROCESSED;
      (event as any).error = null;
      await this.outboxRepository.save(event);
      console.log(`[OutboxRelayProcessor] Event ${event.id} saved as PROCESSED`);
    } catch (err) {
      console.error(`[OutboxRelayProcessor] Handler FAILED for event ${event.id}:`, err.message);
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
