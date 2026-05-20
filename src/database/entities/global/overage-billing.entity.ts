import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from './hotel.entity';

export enum OverageType {
  ROOMS = 'rooms',
  USERS = 'users',
  STORAGE = 'storage',
}

export enum OverageStatus {
  PENDING = 'pending',
  BILLED = 'billed',
  WAIVED = 'waived',
  COLLECTED = 'collected',
}

@Entity({ name: 'overage_billing', schema: 'global' })
@Index(['hotelId', 'status'])
@Index(['hotelId', 'billingPeriodStart'])
export class OverageBilling extends BaseEntity {
  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column({ type: 'enum', enum: OverageType })
  overageType: OverageType;

  @Column({ type: 'enum', enum: OverageStatus, default: OverageStatus.PENDING })
  status: OverageStatus;

  @Column({ type: 'integer', default: 0 })
  overageUnits: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'timestamptz' })
  billingPeriodStart: Date;

  @Column({ type: 'timestamptz' })
  billingPeriodEnd: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
