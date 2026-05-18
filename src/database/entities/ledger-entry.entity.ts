import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'ledger_entries' })
@Index(['referenceType', 'referenceId'])
@Index(['bookingId'])
@Index(['entryDate'])
export class LedgerEntry extends BaseEntity {
  @Column()
  accountId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  debit: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  credit: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column()
  referenceType: string;

  @Column()
  referenceId: string;

  @Column({ nullable: true })
  bookingId: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  entryDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;
}
