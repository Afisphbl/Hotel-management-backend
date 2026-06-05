import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AnalyticsSnapshot,
  SnapshotType,
} from '../../../database/entities/analytics-snapshot.entity';
import {
  Booking,
  BookingStatus,
} from '../../../database/entities/booking.entity';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { Hotel, HotelStatus } from '../../../database/entities/hotel.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../../../database/entities/global/subscriptions.entity';
import { User } from '../../../database/entities/user.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(AnalyticsSnapshot)
    private snapshotRepository: Repository<AnalyticsSnapshot>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
  ) {}

  async computePlatformKPIs(): Promise<AnalyticsSnapshot> {
    this.logger.log('Computing Platform KPIs...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalHotels, activeSubscriptions] = await Promise.all([
      this.hotelRepository.count(),
      this.dataSource.getRepository(Subscription).count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
    ]);

    // MRR calculation
    const mrrResult = (await this.dataSource
      .getRepository(Subscription)
      .createQueryBuilder('sub')
      .select('SUM(sub.price)', 'mrr')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .getRawOne()) as { mrr: string | null } | null;
    const mrr = Number(mrrResult?.mrr || 0);

    // Count distinct hotel owners
    const ownerResult = (await this.dataSource
      .getRepository(Hotel)
      .createQueryBuilder('hotel')
      .select('COUNT(DISTINCT hotel.ownerEmail)', 'count')
      .where('hotel.ownerEmail IS NOT NULL')
      .andWhere("hotel.ownerEmail != ''")
      .getRawOne()) as { count: string } | null;
    const hotelOwners = Number(ownerResult?.count || 0);

    const previousSnapshot = await this.snapshotRepository.findOne({
      where: { snapshotType: SnapshotType.PLATFORM_KPI },
      order: { periodStart: 'DESC' },
    });

    const previousHotels = previousSnapshot?.data?.totalHotels ?? totalHotels;
    const previousMrr = previousSnapshot?.data?.mrr ?? mrr;

    const hotelsGrowth =
      previousHotels > 0
        ? Math.round(
            ((totalHotels - previousHotels) / previousHotels) * 10000,
          ) / 100
        : 0;

    const mrrGrowth =
      previousMrr > 0
        ? Math.round(((mrr - previousMrr) / previousMrr) * 10000) / 100
        : 0;

    const data = {
      totalHotels,
      activeSubscriptions,
      mrr,
      hotelOwners,
      mrrGrowth,
      hotelsGrowth,
      timestamp: new Date().toISOString(),
    };

    return this.saveSnapshot(
      SnapshotType.PLATFORM_KPI,
      today,
      new Date(),
      data,
    );
  }

  async computePlatformRevenue(): Promise<AnalyticsSnapshot> {
    this.logger.log('Computing Platform Revenue...');
    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const revenueData = await Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const year = d.getFullYear();
        const monthIndex = d.getMonth();

        const startOfMonth = new Date(year, monthIndex, 1);
        const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

        const paymentResult = (await this.dataSource
          .getRepository('SubscriptionPayment')
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.amount), 0)', 'total')
          .where('p.status = :status', { status: 'completed' })
          .andWhere('p.paidAt >= :start', { start: startOfMonth })
          .andWhere('p.paidAt <= :end', { end: endOfMonth })
          .getRawOne()) as { total: string } | null;

        const revenue = Number(paymentResult?.total || 0);

        return {
          month: monthNames[monthIndex],
          revenue,
          collected: revenue,
        };
      }),
    );

    return this.saveSnapshot(
      SnapshotType.PLATFORM_REVENUE,
      periodStart,
      today,
      { chart: revenueData },
    );
  }

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
      currency: 'ETB',
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
        where: { status: status },
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

  async findRecent(
    type: SnapshotType,
    limit = 30,
  ): Promise<AnalyticsSnapshot[]> {
    return this.snapshotRepository.find({
      where: { snapshotType: type },
      order: { periodStart: 'DESC' },
      take: limit,
    });
  }
}
