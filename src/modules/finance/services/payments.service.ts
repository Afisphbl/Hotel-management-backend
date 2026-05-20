import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../../database/entities/payment.entity';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import { OutboxEvent } from '../../../database/entities/outbox-event.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { CreatePaymentDto, QueryPaymentDto } from '../dto/payment.dto';
import { paginate, PaginatedResult } from '../common/pagination';
import { PaymentGatewayService } from '../../../common/services/payment-gateway.service';

@Injectable()
export class PaymentsService {
  constructor(
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
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  async findAll(query: QueryPaymentDto): Promise<PaginatedResult<Payment>> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.method) where.method = query.method;
    if (query.dateFrom || query.dateTo) {
      where.paidAt = {};
      if (query.dateFrom) where.paidAt.gte = query.dateFrom;
      if (query.dateTo) where.paidAt.lte = query.dateTo;
    }

    return paginate<Payment>(this.paymentRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { createdAt: 'DESC' },
      relations: ['invoice'],
    });
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['invoice', 'booking'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async processPayment(dto: CreatePaymentDto): Promise<Payment> {
    const queryRunner =
      this.paymentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check idempotency
      const existingByIdempotency = await queryRunner.manager.findOne(Payment, {
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingByIdempotency) {
        await queryRunner.rollbackTransaction();
        return existingByIdempotency;
      }

      if (dto.transactionId) {
        const existingByTransaction = await queryRunner.manager.findOne(
          Payment,
          {
            where: { transactionId: dto.transactionId },
          },
        );
        if (existingByTransaction) {
          await queryRunner.rollbackTransaction();
          return existingByTransaction;
        }
      }

      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        relations: ['booking'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const bookingId = dto.bookingId || invoice.bookingId;
      const fee = dto.fee ?? 0;
      const netAmount = dto.amount - fee;

      // 2. Create payment record
      const payment = queryRunner.manager.create(Payment, {
        invoiceId: dto.invoiceId,
        bookingId: bookingId || undefined,
        amount: dto.amount,
        fee,
        netAmount,
        currency: dto.currency || 'USD',
        method: dto.method,
        status: PaymentStatus.COMPLETED,
        transactionId: dto.transactionId,
        gatewayResponse:
          dto.gatewayResponse ??
          (await this.paymentGatewayService.buildGatewayResponse({
            paymentId: dto.idempotencyKey,
            amount: dto.amount,
            currency: dto.currency || 'USD',
            method: dto.method,
            transactionId: dto.transactionId,
          })),
        idempotencyKey: dto.idempotencyKey,
        description: dto.description,
        paidAt: new Date(),
      });
      const saved = await queryRunner.manager.save(payment);

      // 3. Create ledger entry
      const ledger = queryRunner.manager.create(LedgerEntry, {
        accountId: 'ACCOUNTS_RECEIVABLE',
        debit: 0,
        credit: dto.amount,
        currency: dto.currency || 'USD',
        referenceType: 'PAYMENT',
        referenceId: saved.id,
        bookingId: bookingId || undefined,
        description:
          dto.description ||
          `Payment via ${dto.method} for invoice ${dto.invoiceId}`,
      });
      await queryRunner.manager.save(ledger);

      if (fee > 0) {
        const feeLedger = queryRunner.manager.create(LedgerEntry, {
          accountId: 'FEES_EXPENSE',
          debit: fee,
          credit: 0,
          currency: dto.currency || 'USD',
          referenceType: 'PAYMENT',
          referenceId: saved.id,
          bookingId: bookingId || undefined,
          description: `Processing fee for payment ${saved.id}`,
        });
        await queryRunner.manager.save(feeLedger);
      }

      // 4. Update invoice status
      if (invoice.status !== InvoiceStatus.PAID) {
        invoice.status = InvoiceStatus.PAID;
        invoice.paidAt = new Date();
        await queryRunner.manager.save(invoice);
      }

      // 5. Create outbox event
      await queryRunner.manager.save(
        queryRunner.manager.create(OutboxEvent, {
          type: 'PAYMENT_PROCESSED',
          payload: {
            paymentId: saved.id,
            invoiceId: dto.invoiceId,
            amount: dto.amount,
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

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByBooking(bookingId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }
}
