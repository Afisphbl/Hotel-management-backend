import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from './hotel.entity';

export enum SubscriptionPaymentMethod {
  CHAPA = 'chapa',
  BANK_TRANSFER = 'bank_transfer',
  MANUAL = 'manual',
}

export enum SubscriptionPaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity({ name: 'subscription_payments', schema: 'global' })
@Index(['hotelId', 'periodStart'])
@Index(['hotelId', 'status'])
@Index(['transactionId'], { unique: true, where: '"transactionId" IS NOT NULL' })
export class SubscriptionPayment extends BaseEntity {
  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', default: 'ETB' })
  currency: string;

  @Column({ type: 'enum', enum: SubscriptionPaymentMethod })
  method: SubscriptionPaymentMethod;

  @Column({
    type: 'enum',
    enum: SubscriptionPaymentStatus,
    default: SubscriptionPaymentStatus.PENDING,
  })
  status: SubscriptionPaymentStatus;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ type: 'jsonb', nullable: true })
  gatewayResponse: any;

  @Column({ type: 'text', nullable: true })
  receiptUrl: string;

  @Column({ nullable: true })
  confirmedByAdminId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
