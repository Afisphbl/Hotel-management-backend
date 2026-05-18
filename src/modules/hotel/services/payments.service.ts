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
    const queryRunner = this.paymentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check for existing payment via idempotency key
      const existingByIdempotency = await queryRunner.manager.findOne(Payment, {
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existingByIdempotency) {
        await queryRunner.rollbackTransaction();
        return existingByIdempotency;
      }

      // 2. Check for existing payment via transaction ID
      if (data.transactionId) {
        const existingByTransaction = await queryRunner.manager.findOne(Payment, {
          where: { transactionId: data.transactionId },
        });
        if (existingByTransaction) {
          await queryRunner.rollbackTransaction();
          return existingByTransaction;
        }
      }

      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: data.invoiceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Invoice is already paid');
      }

      // 3. Create payment record
      const payment = queryRunner.manager.create(Payment, {
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        status: PaymentStatus.COMPLETED,
        transactionId: data.transactionId,
        gatewayResponse: data.gatewayResponse,
        idempotencyKey: data.idempotencyKey,
        paidAt: new Date(),
      });
      const saved = await queryRunner.manager.save(payment);

      // 4. Create ledger entry
      const ledger = queryRunner.manager.create(LedgerEntry, {
        accountId: 'ACCOUNTS_RECEIVABLE',
        debit: 0,
        credit: data.amount,
        referenceType: 'PAYMENT',
        referenceId: saved.id,
        description: `Payment ${data.method} for invoice ${data.invoiceId}`,
      });
      await queryRunner.manager.save(ledger);

      // 5. Update invoice status
      invoice.status = InvoiceStatus.PAID;
      await queryRunner.manager.save(invoice);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async refund(paymentId: string, data: {
    amount: number;
    reason: RefundReason;
    idempotencyKey: string;
    notes?: string;
  }): Promise<Refund> {
    const queryRunner = this.paymentRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check idempotency
      const existing = await queryRunner.manager.findOne(Refund, {
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        await queryRunner.rollbackTransaction();
        return existing;
      }

      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException('Payment already fully refunded');
      }

      // 2. Create refund record
      const refund = queryRunner.manager.create(Refund, {
        paymentId,
        amount: data.amount,
        reason: data.reason,
        status: RefundStatus.COMPLETED,
        idempotencyKey: data.idempotencyKey,
        processedAt: new Date(),
        notes: data.notes,
      });
      const saved = await queryRunner.manager.save(refund);

      // 3. Create ledger entry
      const ledger = queryRunner.manager.create(LedgerEntry, {
        accountId: 'ACCOUNTS_RECEIVABLE',
        debit: data.amount,
        credit: 0,
        referenceType: 'REFUND',
        referenceId: saved.id,
        description: `Refund for payment ${paymentId}: ${data.reason}`,
      });
      await queryRunner.manager.save(ledger);

      // 4. Update payment status
      const totalRefundedResult = await queryRunner.manager
        .createQueryBuilder(Refund, 'refund')
        .where('refund.paymentId = :paymentId', { paymentId })
        .select('SUM(refund.amount)', 'total')
        .getRawOne();

      const totalRefunded = Number(totalRefundedResult?.total || 0);

      if (totalRefunded >= Number(payment.amount)) {
        payment.status = PaymentStatus.REFUNDED;
      } else {
        payment.status = PaymentStatus.PARTIALLY_REFUNDED;
      }
      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getRefunds(paymentId: string): Promise<Refund[]> {
    return this.refundRepository.find({
      where: { paymentId },
      order: { createdAt: 'DESC' },
    });
  }
}
