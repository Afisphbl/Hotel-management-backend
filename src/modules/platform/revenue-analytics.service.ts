import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThan, MoreThan } from 'typeorm';
import { Subscription, SubscriptionPlan, SubscriptionStatus } from '../../database/entities/global/subscriptions.entity';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';
import { AnalyticsSnapshot, SnapshotType } from '../../database/entities/analytics-snapshot.entity';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class RevenueAnalyticsService {
  private readonly logger = new Logger(RevenueAnalyticsService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(AnalyticsSnapshot)
    private snapshotRepository: Repository<AnalyticsSnapshot>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getMRRBreakdown() {
    const activeSubscriptions = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['hotel'],
    });

    const mrrByPlan: Record<string, { count: number; revenue: number; hotels: string[] }> = {};
    let totalMRR = 0;
    let totalOverageMRR = 0;

    for (const sub of activeSubscriptions) {
      const plan = sub.plan;
      const price = Number(sub.price);
      const overage = Number(sub.overageBilled || 0);

      if (!mrrByPlan[plan]) {
        mrrByPlan[plan] = { count: 0, revenue: 0, hotels: [] };
      }
      mrrByPlan[plan].count++;
      mrrByPlan[plan].revenue += price;
      mrrByPlan[plan].hotels.push(sub.hotel?.name || 'Unknown');
      totalMRR += price;
      totalOverageMRR += overage;
    }

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthSubs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE, createdAt: LessThan(lastMonth) },
    });
    const lastMonthMRR = lastMonthSubs.reduce((sum, s) => sum + Number(s.price), 0);
    const mrrGrowth = lastMonthMRR > 0 ? ((totalMRR - lastMonthMRR) / lastMonthMRR) * 100 : 0;

    return {
      totalMRR,
      totalARR: totalMRR * 12,
      totalOverageMRR,
      mrrGrowth: Math.round(mrrGrowth * 100) / 100,
      planBreakdown: Object.entries(mrrByPlan).map(([plan, data]) => ({
        plan,
        hotelCount: data.count,
        revenue: data.revenue,
        revenueShare: totalMRR > 0 ? Math.round((data.revenue / totalMRR) * 10000) / 100 : 0,
      })),
      averageRevenuePerHotel: activeSubscriptions.length > 0
        ? Math.round(totalMRR / activeSubscriptions.length * 100) / 100
        : 0,
      totalSubscriptions: activeSubscriptions.length,
      currency: 'USD',
      computedAt: new Date(),
    };
  }

  async getChurnMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const totalActive = await this.subscriptionRepository.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    const cancelledLast30 = await this.subscriptionRepository.count({
      where: {
        status: SubscriptionStatus.CANCELLED,
        updatedAt: MoreThan(thirtyDaysAgo),
      },
    });

    const cancelledLast60 = await this.subscriptionRepository.count({
      where: {
        status: SubscriptionStatus.CANCELLED,
        updatedAt: MoreThan(sixtyDaysAgo),
      },
    });

    const cancelledRevenue = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .select('COALESCE(SUM(sub.price), 0)', 'total')
      .where('sub.status = :status', { status: SubscriptionStatus.CANCELLED })
      .andWhere('sub.updatedAt > :since', { since: thirtyDaysAgo })
      .getRawOne();
    const lostRevenue = Number(cancelledRevenue?.total || 0);

    const totalSubsEver = await this.subscriptionRepository.count();

    const churnRate = totalActive + cancelledLast30 > 0
      ? Math.round((cancelledLast30 / (totalActive + cancelledLast30)) * 10000) / 100
      : 0;

    let netRetention = 0;
    const activeAtStart = await this.subscriptionRepository.count({
      where: { status: SubscriptionStatus.ACTIVE, createdAt: LessThan(thirtyDaysAgo) },
    });
    if (activeAtStart > 0) {
      netRetention = Math.round(((activeAtStart - cancelledLast30) / activeAtStart) * 10000) / 100;
    }

    const mrrBreakdown = await this.getMRRBreakdown();
    const mrrChurned = cancelledLast30 > 0 ? lostRevenue : 0;

    return {
      churnRate,
      netRetention,
      totalActiveSubscriptions: totalActive,
      cancelledLast30Days: cancelledLast30,
      cancelledLast60Days: cancelledLast60,
      lostRevenueLast30Days: lostRevenue,
      mrrChurned,
      totalSubscriptionsEver: totalSubsEver,
      negativeGrowth: churnRate > 10,
      computedAt: new Date(),
    };
  }

  async getDetailedFinancialReport(startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const subscriptions = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['hotel'],
    });

    const monthlyData: Array<{
      month: string;
      year: number;
      subscriptionRevenue: number;
      overageRevenue: number;
      totalRevenue: number;
      activeSubscriptions: number;
      newSubscriptions: number;
      churnedSubscriptions: number;
    }> = [];

    let cursor = new Date(start);
    while (cursor <= end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);

      const activeInMonth = subscriptions.filter(s =>
        new Date(s.startDate) <= monthEnd &&
        (!s.endDate || new Date(s.endDate) >= monthStart),
      );

      const newInMonth = activeInMonth.filter(s =>
        s.createdAt >= monthStart && s.createdAt <= monthEnd,
      );

      const churnedInMonth = await this.subscriptionRepository.count({
        where: {
          status: SubscriptionStatus.CANCELLED,
          updatedAt: Between(monthStart, monthEnd),
        },
      });

      const subRevenue = activeInMonth.reduce((sum, s) => sum + Number(s.price), 0);
      const overageRevenue = activeInMonth.reduce((sum, s) => sum + Number(s.overageBilled || 0), 0);

      monthlyData.push({
        month: cursor.toLocaleString('default', { month: 'short' }),
        year: cursor.getFullYear(),
        subscriptionRevenue: Math.round(subRevenue * 100) / 100,
        overageRevenue: Math.round(overageRevenue * 100) / 100,
        totalRevenue: Math.round((subRevenue + overageRevenue) * 100) / 100,
        activeSubscriptions: activeInMonth.length,
        newSubscriptions: newInMonth.length,
        churnedSubscriptions: churnedInMonth,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    const totalRevenue = monthlyData.reduce((s, m) => s + m.totalRevenue, 0);

    return {
      period: { start, end },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageMonthlyRevenue: monthlyData.length > 0
          ? Math.round((totalRevenue / monthlyData.length) * 100) / 100
          : 0,
        subscriptionRevenue: Math.round(monthlyData.reduce((s, m) => s + m.subscriptionRevenue, 0) * 100) / 100,
        overageRevenue: Math.round(monthlyData.reduce((s, m) => s + m.overageRevenue, 0) * 100) / 100,
        totalMonths: monthlyData.length,
      },
      monthlyData,
      computedAt: new Date(),
    };
  }

  async getRevenueProjection(months = 3) {
    const mrr = await this.getMRRBreakdown();
    const churn = await this.getChurnMetrics();
    const monthlyChurnRate = churn.churnRate / 100;

    const projections: Array<{
      month: string;
      projectedMRR: number;
      projectedChurn: number;
      projectedNew: number;
    }> = [];

    let projectedMRR = mrr.totalMRR;
    const avgNewRevenue = mrr.averageRevenuePerHotel * 2;

    for (let i = 1; i <= months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      const churned = projectedMRR * monthlyChurnRate;
      const newRevenue = avgNewRevenue;

      projectedMRR = projectedMRR - churned + newRevenue;

      projections.push({
        month: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        projectedMRR: Math.round(projectedMRR * 100) / 100,
        projectedChurn: Math.round(churned * 100) / 100,
        projectedNew: Math.round(newRevenue * 100) / 100,
      });
    }

    return {
      currentMRR: mrr.totalMRR,
      monthlyChurnRate: Math.round(monthlyChurnRate * 10000) / 100,
      projections,
      computedAt: new Date(),
    };
  }
}
