import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund, RefundReason, RefundStatus } from '../../../database/entities/refund.entity';
import { Payment, PaymentStatus } from '../../../database/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
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
    const payment = await this.paymentRepository.findOne({
      where: { id: dto.paymentId },
      relations: ['invoice'],
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment already fully refunded');
    }

    const invoiceId = dto.invoiceId || payment.invoiceId;
    const bookingId = dto.bookingId || payment.bookingId;

    const totalRefunded = await this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.paymentId = :paymentId', { paymentId: dto.paymentId })
      .select('COALESCE(SUM(refund.amount), 0)', 'total')
      .getRawOne();

    const refundedSoFar = Number(totalRefunded?.total || 0);
    const remaining = Number(payment.amount) - refundedSoFar;
    if (dto.amount > remaining) {
      throw new BadRequestException(
        `Refund amount ${dto.amount} exceeds remaining balance ${remaining}`,
      );
    }

    const refund = this.refundRepository.create({
      paymentId: dto.paymentId,
      invoiceId: invoiceId || undefined,
      bookingId: bookingId || undefined,
      amount: dto.amount,
      currency: dto.currency || 'USD',
      reason: dto.reason,
      status: RefundStatus.COMPLETED,
      transactionId: dto.transactionId,
      idempotencyKey: dto.idempotencyKey,
      processedAt: new Date(),
      notes: dto.notes,
    });
    const saved = await this.refundRepository.save(refund);

    const ledger = this.ledgerRepository.create({
      accountId: 'ACCOUNTS_RECEIVABLE',
      debit: dto.amount,
      credit: 0,
      currency: dto.currency || 'USD',
      referenceType: 'REFUND',
      referenceId: saved.id,
      bookingId: bookingId || undefined,
      description: `Refund: ${dto.reason} for payment ${dto.paymentId}`,
    });
    await this.ledgerRepository.save(ledger);

    const newTotal = refundedSoFar + dto.amount;
    if (newTotal >= Number(payment.amount)) {
      payment.status = PaymentStatus.REFUNDED;
    } else {
      payment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }
    await this.paymentRepository.save(payment);

    return saved;
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
