import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { Guest } from '../../../database/entities/guest.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {}

  private baseQuery() {
    return this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndMapOne('invoice.booking', Booking, 'booking', 'booking.id = invoice."bookingId"')
      .leftJoinAndMapOne('booking.guest', Guest, 'guest', 'guest.id = booking."guestId"');
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: InvoiceStatus;
    bookingId?: string;
  }) {
    const qb = this.baseQuery();
    if (options.status) {
      qb.andWhere('invoice.status = :status', { status: options.status });
    }
    if (options.bookingId) {
      qb.andWhere('invoice."bookingId" = :bookingId', {
        bookingId: options.bookingId,
      });
    }
    qb.orderBy('invoice.createdAt', 'DESC');

    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Invoice> {
    const invoice = await this.baseQuery()
      .where('invoice.id = :id', { id })
      .getOne();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async issue(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOneBy({ id });
    if (!invoice) throw new NotFoundException('Invoice not found');
    invoice.status = InvoiceStatus.ISSUED;
    return this.invoiceRepository.save(invoice);
  }

  async markPaid(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOneBy({ id });
    if (!invoice) throw new NotFoundException('Invoice not found');
    invoice.status = InvoiceStatus.PAID;
    return this.invoiceRepository.save(invoice);
  }

  async void(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOneBy({ id });
    if (!invoice) throw new NotFoundException('Invoice not found');
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
