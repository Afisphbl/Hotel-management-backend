import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'ledger_entries' })
export class LedgerEntry extends BaseEntity {
  @Column()
  accountId: string; // e.g., 'REVENUE', 'CASH', 'ACCOUNTS_RECEIVABLE'

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  debit: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  credit: number;

  @Column()
  referenceType: string; // e.g., 'BOOKING', 'PAYMENT'

  @Column()
  referenceId: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
