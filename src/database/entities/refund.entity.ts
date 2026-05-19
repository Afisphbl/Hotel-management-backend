import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Payment } from './payment.entity';
import { Invoice } from './invoice.entity';
import { Booking } from './booking.entity';

export enum RefundReason {
  CANCELLATION = 'cancellation',
  OVERPAYMENT = 'overpayment',
  DISPUTE = 'dispute',
  CHARGEBACK = 'chargeback',
  OTHER = 'other',
}

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity({ name: 'refunds' })
@Index(['paymentId'])
@Index(['invoiceId'])
@Index(['bookingId'])
@Index(['idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
export class Refund extends BaseEntity {
  @Column()
  paymentId: string;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ nullable: true })
  invoiceId: string;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ nullable: true })
  bookingId: string;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: RefundReason,
  })
  reason: RefundReason;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.COMPLETED,
  })
  status: RefundStatus;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ nullable: true })
  idempotencyKey: string;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
