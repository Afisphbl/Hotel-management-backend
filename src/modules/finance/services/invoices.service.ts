import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { Booking } from '../../../database/entities/booking.entity';
import {
  TaxRule,
  TaxApplication,
} from '../../../database/entities/tax-rule.entity';
import { OutboxEvent } from '../../../database/entities/outbox-event.entity';
import { CreateInvoiceDto, QueryInvoiceDto } from '../dto/invoice.dto';
import { paginate, PaginatedResult } from '../common/pagination';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(TaxRule)
    private taxRuleRepository: Repository<TaxRule>,
    @InjectRepository(OutboxEvent)
    private outboxRepository: Repository<OutboxEvent>,
  ) {}

  async findAll(query: QueryInvoiceDto): Promise<PaginatedResult<Invoice>> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.bookingId) where.bookingId = query.bookingId;

    return paginate<Invoice>(this.invoiceRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { createdAt: 'DESC' },
      relations: ['booking'],
    });
  }

  async findById(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['booking'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createForBooking(dto: CreateInvoiceDto): Promise<Invoice> {
    const booking = await this.bookingRepository.findOneBy({
      id: dto.bookingId,
    });
    if (!booking) throw new NotFoundException('Booking not found');

    let subtotal = 0;
    let taxTotal = 0;
    let amount = 0;

    if (dto.lineItems && dto.lineItems.length > 0) {
      for (const item of dto.lineItems) {
        const lineTotal = item.quantity * item.unitPrice;
        subtotal += lineTotal;
        const taxRate = item.taxRate || 0;
        taxTotal += lineTotal * (taxRate / 100);
      }
      amount = subtotal + taxTotal;
    } else {
      const taxRules = await this.taxRuleRepository.find({
        where: { isActive: true },
      });
      subtotal = Number(booking.totalPrice) || dto.amount || 0;
      for (const rule of taxRules) {
        if (rule.application === TaxApplication.PERCENTAGE) {
          taxTotal += subtotal * (Number(rule.rate) / 100);
        } else if (rule.application === TaxApplication.PER_BOOKING) {
          taxTotal += Number(rule.rate);
        }
      }
      amount = subtotal + taxTotal;
    }

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${booking.id.slice(0, 8).toUpperCase()}`;

    const invoice = this.invoiceRepository.create({
      invoiceNumber,
      bookingId: dto.bookingId,
      amount,
      subtotal,
      taxTotal,
      currency: dto.currency || 'USD',
      status: InvoiceStatus.DRAFT,
      lineItems: dto.lineItems || [],
      dueDate: dto.dueDate
        ? new Date(dto.dueDate)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: dto.notes,
    });
    const saved = await this.invoiceRepository.save(invoice);

    await this.outboxRepository.save(
      this.outboxRepository.create({
        type: 'INVOICE_CREATED',
        payload: { invoiceId: saved.id, bookingId: dto.bookingId, amount },
      }),
    );

    return saved;
  }

  async issue(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be issued');
    }
    invoice.status = InvoiceStatus.ISSUED;
    const saved = await this.invoiceRepository.save(invoice);

    await this.outboxRepository.save(
      this.outboxRepository.create({
        type: 'INVOICE_ISSUED',
        payload: { invoiceId: saved.id, bookingId: saved.bookingId },
      }),
    );

    return saved;
  }

  async markPaid(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    invoice.status = InvoiceStatus.PAID;
    invoice.paidAt = new Date();
    return this.invoiceRepository.save(invoice);
  }

  async markOverdue(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (invoice.status === InvoiceStatus.ISSUED) {
      invoice.status = InvoiceStatus.OVERDUE;
    }
    return this.invoiceRepository.save(invoice);
  }

  async void(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (invoice.status === InvoiceStatus.VOID) return invoice;
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot void a paid invoice');
    }
    invoice.status = InvoiceStatus.VOID;
    const saved = await this.invoiceRepository.save(invoice);

    await this.outboxRepository.save(
      this.outboxRepository.create({
        type: 'INVOICE_VOIDED',
        payload: { invoiceId: saved.id, bookingId: saved.bookingId },
      }),
    );

    return saved;
  }

  async findByBooking(bookingId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }
}
