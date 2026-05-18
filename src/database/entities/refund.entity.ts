import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum RefundReason {
  CANCELLATION = 'cancellation',
  OVERPAYMENT = 'overpayment',
  DISPUTE = 'dispute',
  OTHER = 'other',
}

@Entity({ name: 'refunds' })
@Index(['paymentId'])
export class Refund extends BaseEntity {
  @Column()
  paymentId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: RefundReason,
  })
  reason: RefundReason;

  @Column({ default: 'completed' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
