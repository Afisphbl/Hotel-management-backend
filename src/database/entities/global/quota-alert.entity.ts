import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from './hotel.entity';

export enum QuotaAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum QuotaAlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

@Entity({ name: 'quota_alerts', schema: 'global' })
@Index(['hotelId', 'status'])
export class QuotaAlert extends BaseEntity {
  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column({ type: 'varchar', length: 50 })
  resourceType: string;

  @Column({ type: 'integer' })
  currentUsage: number;

  @Column({ type: 'integer' })
  limitValue: number;

  @Column({ type: 'integer' })
  thresholdPercent: number;

  @Column({
    type: 'enum',
    enum: QuotaAlertSeverity,
    default: QuotaAlertSeverity.WARNING,
  })
  severity: QuotaAlertSeverity;

  @Column({
    type: 'enum',
    enum: QuotaAlertStatus,
    default: QuotaAlertStatus.ACTIVE,
  })
  status: QuotaAlertStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
