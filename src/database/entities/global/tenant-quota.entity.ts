import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from './hotel.entity';

@Entity({ name: 'tenant_quotas', schema: 'global' })
@Index(['hotelId'], { unique: true })
export class TenantQuota extends BaseEntity {
  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column({ type: 'integer', default: 0 })
  maxUsers: number;

  @Column({ type: 'integer', default: 0 })
  maxRooms: number;

  @Column({ type: 'integer', default: 0 })
  maxStorageMb: number;

  @Column({ type: 'integer', default: 0 })
  currentUsers: number;

  @Column({ type: 'integer', default: 0 })
  currentRooms: number;

  @Column({ type: 'integer', default: 0 })
  currentStorageMb: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  overageAmount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastOverageBilledAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  peakRooms: number;

  @Column({ type: 'integer', default: 0 })
  peakUsers: number;

  @Column({ type: 'integer', default: 0 })
  peakStorageMb: number;

  @Column({ type: 'timestamptz', nullable: true })
  quotaCheckinAt: Date | null;
}
