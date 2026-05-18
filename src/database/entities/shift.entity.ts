import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum ShiftStatus {
  SCHEDULED = 'scheduled',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  NO_SHOW = 'no_show',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'shifts' })
@Index(['staffId'])
@Index(['startTime'])
@Index(['status'])
export class Shift extends BaseEntity {
  @Column()
  staffId: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: ShiftStatus,
    default: ShiftStatus.SCHEDULED,
  })
  status: ShiftStatus;

  @Column({ type: 'timestamptz', nullable: true })
  checkInTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  checkOutTime: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
