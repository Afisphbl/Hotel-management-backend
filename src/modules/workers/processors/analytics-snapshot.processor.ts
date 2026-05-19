import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { SnapshotType } from '../../../database/entities/analytics-snapshot.entity';

export type SnapshotJobData = { type: 'all' } | { type: SnapshotType };

@Processor('analytics-snapshot')
export class AnalyticsSnapshotProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsSnapshotProcessor.name);

  constructor(private analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job<SnapshotJobData>): Promise<any> {
    const jobType = job.data.type;

    this.logger.log(`Computing analytics snapshot: ${jobType}`);

    switch (jobType) {
      case 'all':
        return this.computeAll();
      case SnapshotType.DAILY_OCCUPANCY:
        return this.analyticsService.computeDailyOccupancy();
      case SnapshotType.REVENUE_SUMMARY:
        return this.analyticsService.computeRevenueSummary();
      case SnapshotType.BOOKING_STATS:
        return this.analyticsService.computeBookingStats();
      default:
        this.logger.warn(`Unknown snapshot type: ${jobType}`);
        return null;
    }
  }

  private async computeAll(): Promise<{
    occupancy: any;
    revenue: any;
    bookingStats: any;
  }> {
    const [occupancy, revenue, bookingStats] = await Promise.all([
      this.analyticsService.computeDailyOccupancy(),
      this.analyticsService.computeRevenueSummary(),
      this.analyticsService.computeBookingStats(),
    ]);

    this.logger.log('All analytics snapshots computed');
    return { occupancy, revenue, bookingStats };
  }
}
