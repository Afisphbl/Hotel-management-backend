import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../../database/entities/payment.entity';
import {
  Refund,
  RefundReason,
  RefundStatus,
} from '../../../database/entities/refund.entity';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    invoiceId?: string;
    method?: PaymentMethod;
  }): Promise<PaginatedResult<Payment>> {
    const where: any = {};
    if (options.status) where.status = options.status;
    if (options.invoiceId) where.invoiceId = options.invoiceId;
    if (options.method) where.method = options.method;

    return paginate<Payment>(this.paymentRepository, {
      page: options.page,
      limit: options.limit,
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({ id });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async processPayment(data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    transactionId?: string;
    gatewayResponse?: any;
    idempotencyKey: string;
  }): Promise<Payment> {
    if (data.transactionId) {
      const existing = await this.paymentRepository.findOneBy({
        transactionId: data.transactionId,
      } as any);
      if (existing) return existing;
    }

    const invoice = await this.invoiceRepository.findOneBy({ id: data.invoiceId });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    const payment = this.paymentRepository.create({
      invoiceId: data.invoiceId,
      amount: data.amount,
      method: data.method,
      status: PaymentStatus.COMPLETED,
      transactionId: data.transactionId,
      gatewayResponse: data.gatewayResponse,
      paidAt: new Date(),
    });
    const saved = await this.paymentRepository.save(payment);

    const ledger = this.ledgerRepository.create({
      accountId: 'ACCOUNTS_RECEIVABLE',
      debit: 0,
      credit: data.amount,
      referenceType: 'PAYMENT',
      referenceId: saved.id,
      description: `Payment ${data.method} for invoice ${data.invoiceId}`,
    });
    await this.ledgerRepository.save(ledger);

    invoice.status = InvoiceStatus.PAID;
    await this.invoiceRepository.save(invoice);

    return saved;
  }

  async refund(paymentId: string, data: {
    amount: number;
    reason: RefundReason;
    notes?: string;
  }): Promise<Refund> {
    const payment = await this.findById(paymentId);
    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment already fully refunded');
    }

    const refund = this.refundRepository.create({
      paymentId,
      amount: data.amount,
      reason: data.reason,
      status: RefundStatus.COMPLETED,
      processedAt: new Date(),
      notes: data.notes,
    });
    const saved = await this.refundRepository.save(refund);

    const ledger = this.ledgerRepository.create({
      accountId: 'ACCOUNTS_RECEIVABLE',
      debit: data.amount,
      credit: 0,
      referenceType: 'REFUND',
      referenceId: saved.id,
      description: `Refund for payment ${paymentId}: ${data.reason}`,
    });
    await this.ledgerRepository.save(ledger);

    const totalRefunded = await this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.paymentId = :paymentId', { paymentId })
      .select('SUM(refund.amount)', 'total')
      .getRawOne();

    if (Number(totalRefunded?.total) >= Number(payment.amount)) {
      payment.status = PaymentStatus.REFUNDED;
    } else {
      payment.status = PaymentStatus.PARTIALLY_REFUNDED;
    }
    await this.paymentRepository.save(payment);

    return saved;
  }

  async getRefunds(paymentId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { paymentId },
      order: { createdAt: 'DESC' },
    });
  }
}
