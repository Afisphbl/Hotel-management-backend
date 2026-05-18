import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  BOTH = 'both',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_CHECKED_IN = 'booking_checked_in',
  BOOKING_CHECKED_OUT = 'booking_checked_out',
  PAYMENT_RECEIVED = 'payment_received',
  REFUND_PROCESSED = 'refund_processed',
  INVOICE_READY = 'invoice_ready',
  INVOICE_OVERDUE = 'invoice_overdue',
  HOUSEKEEPING_TASK = 'housekeeping_task',
  MAINTENANCE_TICKET = 'maintenance_ticket',
  SHIFT_REMINDER = 'shift_reminder',
}

@Entity({ name: 'notifications' })
@Index(['userId', 'status'])
@Index(['type'])
export class Notification extends BaseEntity {
  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data: any;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date;

  @Column({ type: 'text', nullable: true })
  error: string;
}
