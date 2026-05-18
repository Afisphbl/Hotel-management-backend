import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../database/entities/invoice.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Refund } from '../../database/entities/refund.entity';
import { TaxRule } from '../../database/entities/tax-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, LedgerEntry, Payment, Refund, TaxRule])],
  exports: [TypeOrmModule],
})
export class FinanceModule {}
