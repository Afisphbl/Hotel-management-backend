import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Refund,
  RefundReason,
  RefundStatus,
} from '../../../database/entities/refund.entity';
import {
  Payment,
  PaymentStatus,
} from '../../../database/entities/payment.entity';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import { OutboxEvent } from '../../../database/entities/outbox-event.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { CreateRefundDto, QueryRefundDto } from '../dto/refund.dto';
import { paginate, PaginatedResult } from '../common/pagination';

@Injectable()
export class RefundsService {
  constructor(
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
    @InjectRepository(OutboxEvent)
    private outboxRepository: Repository<OutboxEvent>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async findAll(query: QueryRefundDto): Promise<PaginatedResult<Refund>> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.paymentId) where.paymentId = query.paymentId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.reason) where.reason = query.reason;

    return paginate<Refund>(this.refundRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { createdAt: 'DESC' },
      relations: ['payment', 'invoice'],
    });
  }

  async findById(id: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({
      where: { id },
      relations: ['payment', 'invoice', 'booking'],
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  async createRefund(dto: CreateRefundDto): Promise<Refund> {
    const queryRunner =
      this.refundRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check idempotency
      const existing = await queryRunner.manager.findOne(Refund, {
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        await queryRunner.rollbackTransaction();
        return existing;
      }

      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: dto.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException('Payment already fully refunded');
      }

      const invoiceId = dto.invoiceId || payment.invoiceId;
      const bookingId = dto.bookingId || payment.bookingId;

      const totalRefundedResult = await queryRunner.manager
        .createQueryBuilder(Refund, 'refund')
        .where('refund.paymentId = :paymentId', { paymentId: dto.paymentId })
        .select('COALESCE(SUM(refund.amount), 0)', 'total')
        .getRawOne();

      const refundedSoFar = Number(totalRefundedResult?.total || 0);
      const remaining = Number(payment.amount) - refundedSoFar;
      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Refund amount ${dto.amount} exceeds remaining balance ${remaining}`,
        );
      }

      // 2. Create refund record
      const refund = queryRunner.manager.create(Refund, {
        paymentId: dto.paymentId,
        invoiceId: invoiceId || undefined,
        bookingId: bookingId || undefined,
        amount: dto.amount,
        currency: dto.currency || 'ETB',
        reason: dto.reason,
        status: RefundStatus.COMPLETED,
        transactionId: dto.transactionId,
        idempotencyKey: dto.idempotencyKey,
        processedAt: new Date(),
        notes: dto.notes,
      });
      const saved = await queryRunner.manager.save(refund);

      // 3. Create ledger entry
      const ledger = queryRunner.manager.create(LedgerEntry, {
        accountId: 'ACCOUNTS_RECEIVABLE',
        debit: dto.amount,
        credit: 0,
        currency: dto.currency || 'ETB',
        referenceType: 'REFUND',
        referenceId: saved.id,
        bookingId: bookingId || undefined,
        description: `Refund: ${dto.reason} for payment ${dto.paymentId}`,
      });
      await queryRunner.manager.save(ledger);

      // 4. Revert invoice to ISSUED if it was PAID
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: invoiceId },
      });
      if (invoice && invoice.status === InvoiceStatus.PAID) {
        invoice.status = InvoiceStatus.ISSUED;
        await queryRunner.manager.save(invoice);
      }

      // 5. Create outbox event
      await queryRunner.manager.save(
        queryRunner.manager.create(OutboxEvent, {
          type: 'REFUND_PROCESSED',
          payload: {
            refundId: saved.id,
            paymentId: dto.paymentId,
            amount: dto.amount,
            reason: dto.reason,
          },
        }),
      );

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findByPayment(paymentId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { paymentId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByBooking(bookingId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }
}
