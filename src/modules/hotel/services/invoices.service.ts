import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
    bookingId?: string;
  }): Promise<PaginatedResult<Invoice>> {
    const where: any = {};
    if (options.status) where.status = options.status;
    if (options.bookingId) where.bookingId = options.bookingId;

    return paginate<Invoice>(this.invoiceRepository, {
      page: options.page,
      limit: options.limit,
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

  async createForBooking(bookingId: string): Promise<Invoice> {
    const booking = await this.bookingRepository.findOneBy({ id: bookingId });
    if (!booking) throw new NotFoundException('Booking not found');

    const invoice = this.invoiceRepository.create({
      bookingId,
      amount: Number(booking.totalPrice),
      status: InvoiceStatus.DRAFT,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    return this.invoiceRepository.save(invoice);
  }

  async issue(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    invoice.status = InvoiceStatus.ISSUED;
    return this.invoiceRepository.save(invoice);
  }

  async markPaid(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    invoice.status = InvoiceStatus.PAID;
    return this.invoiceRepository.save(invoice);
  }

  async void(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    invoice.status = InvoiceStatus.VOID;
    return this.invoiceRepository.save(invoice);
  }

  async findByBooking(bookingId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }
}
