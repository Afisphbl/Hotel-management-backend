import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../database/entities/invoice.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Refund } from '../../database/entities/refund.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { TaxRule } from '../../database/entities/tax-rule.entity';
import { Booking } from '../../database/entities/booking.entity';
import { PaymentsController } from './controllers/payments.controller';
import { RefundsController } from './controllers/refunds.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { LedgerController } from './controllers/ledger.controller';
import { TaxRulesController } from './controllers/tax-rules.controller';
import { PaymentsService } from './services/payments.service';
import { RefundsService } from './services/refunds.service';
import { InvoicesService } from './services/invoices.service';
import { LedgerService } from './services/ledger.service';
import { TaxRulesService } from './services/tax-rules.service';
import { PaymentGatewayService } from '../../common/services/payment-gateway.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      LedgerEntry,
      Payment,
      Refund,
      OutboxEvent,
      TaxRule,
      Booking,
    ]),
  ],
  controllers: [
    PaymentsController,
    RefundsController,
    InvoicesController,
    LedgerController,
    TaxRulesController,
  ],
  providers: [
    PaymentsService,
    RefundsService,
    InvoicesService,
    LedgerService,
    TaxRulesService,
    PaymentGatewayService,
  ],
  exports: [
    PaymentsService,
    RefundsService,
    InvoicesService,
    LedgerService,
    TaxRulesService,
    PaymentGatewayService,
  ],
})
export class FinanceModule {}
