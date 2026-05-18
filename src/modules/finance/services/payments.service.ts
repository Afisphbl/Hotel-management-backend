import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from '../../../database/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import { OutboxEvent } from '../../../database/entities/outbox-event.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { CreatePaymentDto, QueryPaymentDto } from '../dto/payment.dto';
import { paginate, PaginatedResult } from '../common/pagination';

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
    const existing = dto.transactionId
      ? await this.paymentRepository.findOneBy({ transactionId: dto.transactionId })
      : null;
    if (existing) return existing;

    const invoice = await this.invoiceRepository.findOne({
      where: { id: dto.invoiceId },
      relations: ['booking'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const bookingId = dto.bookingId || invoice.bookingId;

    const fee = dto.fee ?? 0;
    const netAmount = dto.amount - fee;

    const payment = this.paymentRepository.create({
      invoiceId: dto.invoiceId,
      bookingId: bookingId || undefined,
      amount: dto.amount,
      fee,
      netAmount,
      currency: dto.currency || 'USD',
      method: dto.method,
      status: PaymentStatus.COMPLETED,
      transactionId: dto.transactionId,
      gatewayResponse: dto.gatewayResponse,
      idempotencyKey: dto.idempotencyKey,
      description: dto.description,
      paidAt: new Date(),
    });
    const saved = await this.paymentRepository.save(payment);

    const ledger = this.ledgerRepository.create({
      accountId: 'ACCOUNTS_RECEIVABLE',
      debit: 0,
      credit: dto.amount,
      currency: dto.currency || 'USD',
      referenceType: 'PAYMENT',
      referenceId: saved.id,
      bookingId: bookingId || undefined,
      description: dto.description || `Payment via ${dto.method} for invoice ${dto.invoiceId}`,
    });
    await this.ledgerRepository.save(ledger);

    if (fee > 0) {
      const feeLedger = this.ledgerRepository.create({
        accountId: 'FEES_EXPENSE',
        debit: fee,
        credit: 0,
        currency: dto.currency || 'USD',
        referenceType: 'PAYMENT',
        referenceId: saved.id,
        bookingId: bookingId || undefined,
        description: `Processing fee for payment ${saved.id}`,
      });
      await this.ledgerRepository.save(feeLedger);
    }

    if (invoice.status !== InvoiceStatus.PAID) {
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
      await this.invoiceRepository.save(invoice);
    }

    await this.outboxRepository.save(this.outboxRepository.create({
      type: 'PAYMENT_PROCESSED',
      payload: { paymentId: saved.id, invoiceId: dto.invoiceId, amount: dto.amount },
    }));

    return saved;
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
