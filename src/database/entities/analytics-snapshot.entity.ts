import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum SnapshotType {
  DAILY_OCCUPANCY = 'daily_occupancy',
  REVENUE_SUMMARY = 'revenue_summary',
  BOOKING_STATS = 'booking_stats',
  HOUSEKEEPING_METRICS = 'housekeeping_metrics',
  MAINTENANCE_METRICS = 'maintenance_metrics',
  PLATFORM_KPI = 'platform_kpi',
  PLATFORM_REVENUE = 'platform_revenue',
  MRR_BREAKDOWN = 'mrr_breakdown',
  CHURN_METRICS = 'churn_metrics',
  FINANCIAL_REPORT = 'financial_report',
  UPTIME_SUMMARY = 'uptime_summary',
}

@Entity({ name: 'analytics_snapshots' })
@Index(['snapshotType', 'periodStart'])
@Index(['hotelId'])
export class AnalyticsSnapshot extends BaseEntity {
  @Column({
    type: 'enum',
    enum: SnapshotType,
  })
  snapshotType: SnapshotType;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'jsonb' })
  data: any;

  @Column({ nullable: true })
  hotelId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
