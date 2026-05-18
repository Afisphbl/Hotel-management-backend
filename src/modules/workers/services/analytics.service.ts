import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AnalyticsSnapshot,
  SnapshotType,
} from '../../../database/entities/analytics-snapshot.entity';
import { Booking, BookingStatus } from '../../../database/entities/booking.entity';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsSnapshot)
    private snapshotRepository: Repository<AnalyticsSnapshot>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {}

  async computeDailyOccupancy(): Promise<AnalyticsSnapshot> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkedIn = await this.bookingRepository.count({
      where: { status: BookingStatus.CHECKED_IN },
    });
    const confirmed = await this.bookingRepository.count({
      where: { status: BookingStatus.CONFIRMED },
    });
    const total = await this.bookingRepository.count();

    return this.saveSnapshot(SnapshotType.DAILY_OCCUPANCY, today, tomorrow, {
      checkedIn,
      confirmed,
      total,
      occupancyRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
      timestamp: new Date().toISOString(),
    });
  }

  async computeRevenueSummary(): Promise<AnalyticsSnapshot> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const paidInvoices = await this.invoiceRepository.find({
      where: { status: InvoiceStatus.PAID },
    });
    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount),
      0,
    );

    return this.saveSnapshot(SnapshotType.REVENUE_SUMMARY, today, tomorrow, {
      totalRevenue,
      paidInvoiceCount: paidInvoices.length,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    });
  }

  async computeBookingStats(): Promise<AnalyticsSnapshot> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const total = await this.bookingRepository.count();
    const byStatus: Record<string, number> = {};
    for (const status of Object.values(BookingStatus)) {
      byStatus[status] = await this.bookingRepository.count({
        where: { status: status as any },
      });
    }

    return this.saveSnapshot(SnapshotType.BOOKING_STATS, today, tomorrow, {
      total,
      byStatus,
      timestamp: new Date().toISOString(),
    });
  }

  private async saveSnapshot(
    type: SnapshotType,
    periodStart: Date,
    periodEnd: Date,
    data: any,
  ): Promise<AnalyticsSnapshot> {
    const snapshot = this.snapshotRepository.create({
      snapshotType: type,
      periodStart,
      periodEnd,
      data,
    });
    const saved = await this.snapshotRepository.save(snapshot);
    this.logger.log(`Analytics snapshot created: ${type}`);
    return saved;
  }

  async findRecent(type: SnapshotType, limit = 30): Promise<AnalyticsSnapshot[]> {
    return this.snapshotRepository.find({
      where: { snapshotType: type },
      order: { periodStart: 'DESC' },
      take: limit,
    });
  }
}
