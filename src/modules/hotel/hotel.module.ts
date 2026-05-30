import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Booking } from '../../database/entities/booking.entity';
import { BookingRoom } from '../../database/entities/booking-room.entity';
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
import { Hotel } from '../../database/entities/hotel.entity';
import { User } from '../../database/entities/user.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { Role } from '../../database/entities/role.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import { HotelOwnerDashboardController } from './controllers/hotel-owner-dashboard.controller';
import { HotelOwnerReportsController } from './controllers/hotel-owner-reports.controller';
import { HotelManagementController } from './controllers/hotel-management.controller';
import { HotelManagementService } from './services/hotel-management.service';
import { HotelManagementExtendedController } from './controllers/hotel-management-extended.controller';
import { HotelManagementExtendedService } from './services/hotel-management-extended.service';
import { HotelOwnerStaffController } from './controllers/hotel-owner-staff.controller';
import { HotelOwnerStaffService } from './services/hotel-owner-staff.service';

import { RoomsController } from './controllers/rooms.controller';
import { RoomTypesController } from './controllers/room-types.controller';
import { GuestsController } from './controllers/guests.controller';

import { HousekeepingController } from './controllers/housekeeping.controller';
import { MaintenanceController } from './controllers/maintenance.controller';
import { StaffController } from './controllers/staff.controller';
import { ShiftsController } from './controllers/shifts.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { PaymentsController } from './controllers/payments.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { PricingController } from './controllers/pricing.controller';
import { PlanLimitGuard } from '../../auth/guards/plan-limit.guard';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';

import { RoomsService } from './services/rooms.service';
import { RoomTypesService } from './services/room-types.service';
import { GuestsService } from './services/guests.service';
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
  BookingRoom,
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
  Hotel,
  User,
  HotelUserAccess,
  Role,
  RolePermission,
  Permission,
];

const controllers = [
  RoomsController,
  RoomTypesController,
  GuestsController,
  HousekeepingController,
  MaintenanceController,
  StaffController,
  ShiftsController,
  InvoicesController,
  PaymentsController,
  DashboardController,
  HotelOwnerDashboardController,
  HotelManagementController,
  HotelManagementExtendedController,
  HotelOwnerStaffController,
  HotelOwnerReportsController,
  PricingController,
];

const services = [
  RoomsService,
  RoomTypesService,
  GuestsService,
  PricingService,
  HousekeepingService,
  MaintenanceService,
  StaffService,
  ShiftsService,
  InvoicesService,
  PaymentsService,
  DashboardService,
  HotelManagementService,
  HotelManagementExtendedService,
  HotelOwnerStaffService,
];

@Module({
  imports: [
    TypeOrmModule.forFeature(entities),
    BullModule.registerQueue({
      name: 'hold-expiry',
    }),
  ],
  controllers,
  providers: [...services, PlanLimitGuard, TenantQuotaService],
  exports: [PricingService],
})
export class HotelModule {}
