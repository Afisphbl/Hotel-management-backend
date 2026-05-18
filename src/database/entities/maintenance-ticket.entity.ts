import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TicketStatus {
  REPORTED = 'reported',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

@Entity({ name: 'maintenance_tickets' })
@Index(['status'])
@Index(['assignedTo'])
@Index(['roomId'])
export class MaintenanceTicket extends BaseEntity {
  @Column()
  roomId: string;

  @Column()
  reportedBy: string;

  @Column({ nullable: true })
  assignedTo: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.REPORTED,
  })
  status: TicketStatus;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  cost: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
