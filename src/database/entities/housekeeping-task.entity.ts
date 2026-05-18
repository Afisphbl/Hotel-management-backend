import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
}

@Entity({ name: 'housekeeping_tasks' })
@Index(['status'])
@Index(['assignedTo'])
@Index(['roomId'])
export class HousekeepingTask extends BaseEntity {
  @Column()
  roomId: string;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  priority: TaskPriority;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date', nullable: true })
  scheduledDate: string;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
