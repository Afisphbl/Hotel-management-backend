import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from '../hotel.entity';

export enum ReportType {
  REVENUE = 'revenue',
  OCCUPANCY = 'occupancy',
  BOOKINGS = 'bookings',
  FINANCIAL = 'financial',
  TAX = 'tax',
  CUSTOM = 'custom',
}

export enum ReportFormat {
  JSON = 'json',
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export enum ReportSchedule {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

@Entity({ name: 'custom_reports', schema: 'global' })
@Index(['hotelId'])
@Index(['createdBy'])
export class CustomReport extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportType, default: ReportType.CUSTOM })
  reportType: ReportType;

  @Column({ nullable: true })
  hotelId: string;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ type: 'jsonb' })
  config: {
    metrics: string[];
    dimensions: string[];
    filters: Record<string, any>;
    dateRange:
      | 'today'
      | 'yesterday'
      | 'this_week'
      | 'last_week'
      | 'this_month'
      | 'last_month'
      | 'this_quarter'
      | 'last_quarter'
      | 'this_year'
      | 'custom';
    startDate?: string;
    endDate?: string;
    groupBy?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  visualizationConfig: Record<string, any>;

  @Column({ type: 'enum', enum: ReportFormat, default: ReportFormat.JSON })
  defaultFormat: ReportFormat;

  @Column({ type: 'enum', enum: ReportSchedule, default: ReportSchedule.NONE })
  schedule: ReportSchedule;

  @Column({ type: 'jsonb', nullable: true })
  scheduleConfig: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  lastRunResult: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
