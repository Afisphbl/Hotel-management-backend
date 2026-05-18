import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Booking } from '../../database/entities/booking.entity';
import { RoomNight } from '../../database/entities/room-night.entity';
import { RoomType } from '../../database/entities/room-type.entity';
import { Room } from '../../database/entities/room.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { LedgerEntry } from '../../database/entities/ledger-entry.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { HousekeepingTask } from '../../database/entities/housekeeping-task.entity';
import { MaintenanceTicket } from '../../database/entities/maintenance-ticket.entity';
import { Staff } from '../../database/entities/staff.entity';
import { Shift } from '../../database/entities/shift.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Refund } from '../../database/entities/refund.entity';
import { TaxRule } from '../../database/entities/tax-rule.entity';

import { RoomsController } from './controllers/rooms.controller';
import { RoomTypesController } from './controllers/room-types.controller';
import { GuestsController } from './controllers/guests.controller';
import { BookingsController } from './controllers/bookings.controller';
import { HousekeepingController } from './controllers/housekeeping.controller';
import { MaintenanceController } from './controllers/maintenance.controller';
import { StaffController } from './controllers/staff.controller';
import { ShiftsController } from './controllers/shifts.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { PaymentsController } from './controllers/payments.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { PricingController } from './controllers/pricing.controller';

import { RoomsService } from './services/rooms.service';
import { RoomTypesService } from './services/room-types.service';
import { GuestsService } from './services/guests.service';
import { BookingsService } from './services/bookings.service';
import { PricingService } from './services/pricing.service';
import { HousekeepingService } from './services/housekeeping.service';
import { MaintenanceService } from './services/maintenance.service';
import { StaffService } from './services/staff.service';
import { ShiftsService } from './services/shifts.service';
import { InvoicesService } from './services/invoices.service';
import { PaymentsService } from './services/payments.service';
import { DashboardService } from './services/dashboard.service';

const entities = [
  Booking,
  RoomNight,
  RoomType,
  Room,
  Guest,
  Invoice,
  LedgerEntry,
  OutboxEvent,
  AuditLog,
  HousekeepingTask,
  MaintenanceTicket,
  Staff,
  Shift,
  Payment,
  Refund,
  TaxRule,
];

const controllers = [
  RoomsController,
  RoomTypesController,
  GuestsController,
  BookingsController,
  HousekeepingController,
  MaintenanceController,
  StaffController,
  ShiftsController,
  InvoicesController,
  PaymentsController,
  DashboardController,
  PricingController,
];

const services = [
  RoomsService,
  RoomTypesService,
  GuestsService,
  BookingsService,
  PricingService,
  HousekeepingService,
  MaintenanceService,
  StaffService,
  ShiftsService,
  InvoicesService,
  PaymentsService,
  DashboardService,
];

@Module({
  imports: [
    TypeOrmModule.forFeature(entities),
    BullModule.registerQueue({
      name: 'hold-expiry',
    }),
  ],
  controllers,
  providers: services,
  exports: [BookingsService, PricingService],
})
export class HotelModule {}
