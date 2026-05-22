import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../../../database/entities/hotel.entity';
import { AuditLog } from '../../../database/entities/audit-log.entity';
import { Booking } from '../../../database/entities/booking.entity';
import { Invoice } from '../../../database/entities/invoice.entity';

@Injectable()
export class HotelManagementExtendedService {
  private readonly logger = new Logger(HotelManagementExtendedService.name);
  constructor(
    @InjectRepository(Hotel)
    private hotelRepo: Repository<Hotel>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Booking)
    private bookingRepo: Repository<Booking>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
  ) {}

  async updateInfo(id: string, data: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    const allowed = ['name', 'location', 'slug', 'ownerName', 'ownerEmail'];
    for (const k of allowed) if (k in data) (hotel as any)[k] = data[k];
    return this.hotelRepo.save(hotel);
  }

  async updateSettings(id: string, settings: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.settings = { ...(hotel.settings || {}), ...(settings || {}) };
    return this.hotelRepo.save(hotel);
  }

  async setTimezoneCurrencyTaxes(id: string, payload: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    if (payload.timezone) hotel.timezone = payload.timezone;
    if (payload.currency) hotel.currency = payload.currency;
    if (payload.taxes)
      hotel.settings = { ...(hotel.settings || {}), taxes: payload.taxes };
    return this.hotelRepo.save(hotel);
  }

  async updateSubscription(id: string, subscription: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.subscription = {
      ...(hotel.subscription || {}),
      ...(subscription || {}),
    };
    return this.hotelRepo.save(hotel);
  }

  async getPerformance(id: string, days = 30) {
    // Lightweight tenant-agnostic metrics: count bookings and paid invoices in last `days`
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const bookings = await this.bookingRepo
      .count({ where: { hotelId: id, createdAt: { $gte: since } } as any })
      .catch(() => 0);
    const revenueResult = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
      .where('invoice.hotelId = :hotelId', { hotelId: id })
      .andWhere('invoice.status = :status', { status: 'PAID' })
      .andWhere('invoice."updatedAt" >= :since', { since })
      .getRawOne()
      .catch(() => ({ revenue: 0 }));

    return {
      bookings: bookings || 0,
      revenue: Number(revenueResult?.revenue || 0),
      since,
    };
  }

  async setBookingPolicies(id: string, policies: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.settings = { ...(hotel.settings || {}), bookingPolicies: policies };
    return this.hotelRepo.save(hotel);
  }

  async addAdmin(id: string, email: string) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    const admins: string[] = (hotel.settings?.admins as string[]) || [];
    if (!admins.includes(email)) admins.push(email);
    hotel.settings = { ...(hotel.settings || {}), admins };
    return this.hotelRepo.save(hotel);
  }

  async setModules(id: string, modules: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.settings = { ...(hotel.settings || {}), modulesEnabled: modules };
    return this.hotelRepo.save(hotel);
  }

  async getAuditLogs(id: string, limit = 50) {
    return this.auditLogRepo.find({
      where: { hotelId: id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async setNotifications(id: string, notifications: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.settings = { ...(hotel.settings || {}), notifications };
    return this.hotelRepo.save(hotel);
  }

  async setPaymentMethods(id: string, methods: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.paymentMethods = methods;
    return this.hotelRepo.save(hotel);
  }

  async setCancellationPolicy(id: string, policy: any) {
    const hotel = await this.hotelRepo.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.cancellationPolicy = policy;
    return this.hotelRepo.save(hotel);
  }
}
