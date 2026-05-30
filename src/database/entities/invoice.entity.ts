import {
  Entity,
  Column,
  Index,
  BeforeUpdate,
  AfterLoad,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  OVERDUE = 'overdue',
  VOID = 'void',
}

const IMMUTABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.PAID,
  InvoiceStatus.VOID,
];

@Entity({ name: 'invoices' })
@Index(['bookingId'])
@Index(['invoiceNumber'], {
  unique: true,
  where: '"invoiceNumber" IS NOT NULL',
})
export class Invoice extends BaseEntity {
  @Column({ nullable: true })
  invoiceNumber: string;

  @Column()
  bookingId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ type: 'varchar', default: 'ETB' })
  currency: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'jsonb', nullable: true })
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    taxRate?: number;
  }[];

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  private _originalStatus: InvoiceStatus;

  @AfterLoad()
  trackOriginalStatus() {
    this._originalStatus = this.status;
  }

  @BeforeUpdate()
  checkImmutability() {
    if (
      this._originalStatus &&
      IMMUTABLE_STATUSES.includes(this._originalStatus)
    ) {
      throw new Error(
        `Invoice is ${this._originalStatus} and cannot be modified`,
      );
    }
  }
}
