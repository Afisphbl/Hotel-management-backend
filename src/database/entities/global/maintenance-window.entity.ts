import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from './hotel.entity';

export enum MaintenanceWindowStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'maintenance_windows', schema: 'global' })
@Index(['hotelId', 'status'])
@Index(['startsAt', 'endsAt'])
export class MaintenanceWindow extends BaseEntity {
  @Column({ nullable: true })
  hotelId: string | null;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({
    type: 'enum',
    enum: MaintenanceWindowStatus,
    default: MaintenanceWindowStatus.SCHEDULED,
  })
  status: MaintenanceWindowStatus;

  @Column({ default: false })
  isGlobal: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy: string;

  @Column({ type: 'jsonb', nullable: true })
  affectedComponents: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
