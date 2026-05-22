/* eslint-disable */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserScope } from '../src/database/entities/user.entity';
import { Permission } from '../src/database/entities/global/permission.entity';
import { Role, RoleScope } from '../src/database/entities/global/role.entity';
import { RolePermission } from '../src/database/entities/global/role-permission.entity';
import { Hotel, HotelStatus } from '../src/database/entities/hotel.entity';
import {
  HotelUserAccess,
  HotelAccessStatus,
} from '../src/database/entities/hotel-user-access.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../src/database/entities/global/subscriptions.entity';
import { RoomType } from '../src/database/entities/room-type.entity';
import { Room, RoomStatus } from '../src/database/entities/room.entity';
import { Guest } from '../src/database/entities/guest.entity';
import {
  Booking,
  BookingStatus,
} from '../src/database/entities/booking.entity';
import { BookingRoom } from '../src/database/entities/booking-room.entity';
import { RatePlan } from '../src/database/entities/rate-plan.entity';
import {
  Promotion,
  DiscountType,
} from '../src/database/entities/promotion.entity';
import { SeasonalRate } from '../src/database/entities/seasonal-rate.entity';
import {
  Staff,
  StaffRole,
  EmploymentType,
  StaffStatus,
} from '../src/database/entities/staff.entity';
import { Shift, ShiftStatus } from '../src/database/entities/shift.entity';
import {
  HousekeepingTask,
  TaskStatus,
  TaskPriority,
} from '../src/database/entities/housekeeping-task.entity';
import {
  MaintenanceTicket,
  TicketStatus,
  TicketPriority,
} from '../src/database/entities/maintenance-ticket.entity';
import {
  RoomNight,
  RoomNightStatus,
} from '../src/database/entities/room-night.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../src/database/entities/payment.entity';
import {
  Invoice,
  InvoiceStatus,
} from '../src/database/entities/invoice.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface RoleDefinition {
  name: string;
  description: string;
  scope: RoleScope;
  permissions: string[];
  hierarchyLevel?: number;
}

const PERMISSIONS = [
  {
    name: 'Rooms Read',
    code: 'rooms:read',
    slug: 'rooms:read',
    description: 'View rooms',
  },
  {
    name: 'Rooms Create',
    code: 'rooms:create',
    slug: 'rooms:create',
    description: 'Add new rooms',
  },
  {
    name: 'Rooms Update',
    code: 'rooms:update',
    slug: 'rooms:update',
    description: 'Edit room details',
  },
  {
    name: 'Rooms Delete',
    code: 'rooms:delete',
    slug: 'rooms:delete',
    description: 'Remove rooms',
  },
  {
    name: 'Rooms Status',
    code: 'rooms:status',
    slug: 'rooms:status',
    description: 'Change room status',
  },
  {
    name: 'Room Types Read',
    code: 'room_types:read',
    slug: 'room_types:read',
    description: 'View room types',
  },
  {
    name: 'Room Types Create',
    code: 'room_types:create',
    slug: 'room_types:create',
    description: 'Add room types',
  },
  {
    name: 'Room Types Update',
    code: 'room_types:update',
    slug: 'room_types:update',
    description: 'Edit room types',
  },
  {
    name: 'Room Types Delete',
    code: 'room_types:delete',
    slug: 'room_types:delete',
    description: 'Delete room types',
  },
  {
    name: 'Bookings Read',
    code: 'bookings:read',
    slug: 'bookings:read',
    description: 'View bookings',
  },
  {
    name: 'Bookings Create',
    code: 'bookings:create',
    slug: 'bookings:create',
    description: 'Create bookings',
  },
  {
    name: 'Bookings Update',
    code: 'bookings:update',
    slug: 'bookings:update',
    description: 'Modify bookings',
  },
  {
    name: 'Bookings Cancel',
    code: 'bookings:cancel',
    slug: 'bookings:cancel',
    description: 'Cancel bookings',
  },
  {
    name: 'Bookings Checkin',
    code: 'bookings:checkin',
    slug: 'bookings:checkin',
    description: 'Check-in guests',
  },
  {
    name: 'Bookings Checkout',
    code: 'bookings:checkout',
    slug: 'bookings:checkout',
    description: 'Check-out guests',
  },
  {
    name: 'Bookings Confirm',
    code: 'bookings:confirm',
    slug: 'bookings:confirm',
    description: 'Confirm booking holds',
  },
  {
    name: 'Guests Read',
    code: 'guests:read',
    slug: 'guests:read',
    description: 'View guest profiles',
  },
  {
    name: 'Guests Create',
    code: 'guests:create',
    slug: 'guests:create',
    description: 'Create guest profiles',
  },
  {
    name: 'Guests Update',
    code: 'guests:update',
    slug: 'guests:update',
    description: 'Edit guest profiles',
  },
  {
    name: 'Guests Delete',
    code: 'guests:delete',
    slug: 'guests:delete',
    description: 'Delete guest profiles',
  },
  {
    name: 'Guests PII Read',
    code: 'guests:pii:read',
    slug: 'guests:pii:read',
    description: 'View guest PII data',
  },
  {
    name: 'Pricing Read',
    code: 'pricing:read',
    slug: 'pricing:read',
    description: 'View pricing',
  },
  {
    name: 'Pricing Manage',
    code: 'pricing:manage',
    slug: 'pricing:manage',
    description: 'Manage rate plans',
  },
  {
    name: 'Pricing Promotions',
    code: 'pricing:promotions',
    slug: 'pricing:promotions',
    description: 'Manage promotions',
  },
  {
    name: 'Pricing Overrides',
    code: 'pricing:overrides',
    slug: 'pricing:overrides',
    description: 'Manage price overrides',
  },
  {
    name: 'Pricing Seasonal',
    code: 'pricing:seasonal',
    slug: 'pricing:seasonal',
    description: 'Manage seasonal rates',
  },
  {
    name: 'Invoices Read',
    code: 'invoices:read',
    slug: 'invoices:read',
    description: 'View invoices',
  },
  {
    name: 'Invoices Create',
    code: 'invoices:create',
    slug: 'invoices:create',
    description: 'Generate invoices',
  },
  {
    name: 'Payments Read',
    code: 'payments:read',
    slug: 'payments:read',
    description: 'View payments',
  },
  {
    name: 'Payments Process',
    code: 'payments:process',
    slug: 'payments:process',
    description: 'Process payments',
  },
  {
    name: 'Payments Refund',
    code: 'payments:refund',
    slug: 'payments:refund',
    description: 'Process refunds',
  },
  {
    name: 'Reports View',
    code: 'reports:view',
    slug: 'reports:view',
    description: 'View financial reports',
  },
  {
    name: 'Ledger Read',
    code: 'ledger:read',
    slug: 'ledger:read',
    description: 'View ledger entries',
  },
  {
    name: 'Tax Manage',
    code: 'tax:manage',
    slug: 'tax:manage',
    description: 'Manage tax rules',
  },
  {
    name: 'Housekeeping Read',
    code: 'housekeeping:read',
    slug: 'housekeeping:read',
    description: 'View housekeeping tasks',
  },
  {
    name: 'Housekeeping Assign',
    code: 'housekeeping:assign',
    slug: 'housekeeping:assign',
    description: 'Assign housekeeping tasks',
  },
  {
    name: 'Housekeeping Update',
    code: 'housekeeping:update',
    slug: 'housekeeping:update',
    description: 'Update housekeeping task status',
  },
  {
    name: 'Maintenance Read',
    code: 'maintenance:read',
    slug: 'maintenance:read',
    description: 'View maintenance tickets',
  },
  {
    name: 'Maintenance Create',
    code: 'maintenance:create',
    slug: 'maintenance:create',
    description: 'Create maintenance tickets',
  },
  {
    name: 'Maintenance Update',
    code: 'maintenance:update',
    slug: 'maintenance:update',
    description: 'Update maintenance tickets',
  },
  {
    name: 'Maintenance Resolve',
    code: 'maintenance:resolve',
    slug: 'maintenance:resolve',
    description: 'Resolve maintenance tickets',
  },
  {
    name: 'Staff Read',
    code: 'staff:read',
    slug: 'staff:read',
    description: 'View staff members',
  },
  {
    name: 'Staff Manage',
    code: 'staff:manage',
    slug: 'staff:manage',
    description: 'Manage staff profiles',
  },
  {
    name: 'Shifts Read',
    code: 'shifts:read',
    slug: 'shifts:read',
    description: 'View shift schedules',
  },
  {
    name: 'Shifts Manage',
    code: 'shifts:manage',
    slug: 'shifts:manage',
    description: 'Manage shift assignments',
  },
  {
    name: 'Hotel Settings',
    code: 'hotel:settings',
    slug: 'hotel:settings',
    description: 'Manage hotel settings',
  },
  {
    name: 'Platform Impersonate',
    code: 'platform:impersonate',
    slug: 'platform:impersonate',
    description: 'Impersonate hotel accounts for support',
  },
  {
    name: 'Platform Manage',
    code: 'platform:manage',
    slug: 'platform:manage',
    description: 'Full platform management',
  },
];

const ROLES: RoleDefinition[] = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full control over the entire platform',
    scope: RoleScope.PLATFORM,
    permissions: PERMISSIONS.map((p) => p.code),
    hierarchyLevel: 100,
  },
  {
    name: 'SUPPORT_ADMIN',
    description: 'Platform support and impersonation access',
    scope: RoleScope.PLATFORM,
    permissions: [
      'rooms:read',
      'bookings:read',
      'guests:read',
      'platform:impersonate',
    ],
    hierarchyLevel: 50,
  },
  {
    name: 'BILLING_ADMIN',
    description: 'Manage platform billing and subscriptions',
    scope: RoleScope.PLATFORM,
    permissions: ['platform:manage'],
    hierarchyLevel: 30,
  },
  {
    name: 'HOTEL_OWNER',
    description: 'Full access to all hotel operations',
    scope: RoleScope.HOTEL,
    permissions: PERMISSIONS.filter(
      (p) => !['platform:impersonate', 'platform:manage'].includes(p.code),
    ).map((p) => p.code),
    hierarchyLevel: 100,
  },
  {
    name: 'HOTEL_MANAGER',
    description: 'Day-to-day hotel management access',
    scope: RoleScope.HOTEL,
    permissions: [
      'rooms:read',
      'rooms:create',
      'rooms:update',
      'rooms:status',
      'room_types:read',
      'room_types:create',
      'room_types:update',
      'bookings:read',
      'bookings:create',
      'bookings:update',
      'bookings:cancel',
      'bookings:checkin',
      'bookings:checkout',
      'bookings:confirm',
      'guests:read',
      'guests:create',
      'guests:update',
      'pricing:read',
      'pricing:manage',
      'pricing:promotions',
      'pricing:overrides',
      'pricing:seasonal',
      'invoices:read',
      'payments:read',
      'reports:view',
      'housekeeping:read',
      'housekeeping:assign',
      'maintenance:read',
      'maintenance:create',
      'maintenance:update',
      'staff:read',
      'shifts:read',
      'shifts:manage',
      'hotel:settings',
    ],
  },
  {
    name: 'REVENUE_MANAGER',
    description: 'Manages pricing, rate plans, and revenue reporting',
    scope: RoleScope.HOTEL,
    permissions: [
      'rooms:read',
      'room_types:read',
      'bookings:read',
      'pricing:read',
      'pricing:manage',
      'pricing:promotions',
      'pricing:overrides',
      'pricing:seasonal',
      'reports:view',
      'invoices:read',
    ],
  },
  {
    name: 'FRONT_DESK',
    description: 'Handles guest check-in/out and daily booking operations',
    scope: RoleScope.HOTEL,
    permissions: [
      'rooms:read',
      'rooms:status',
      'room_types:read',
      'bookings:read',
      'bookings:create',
      'bookings:update',
      'bookings:cancel',
      'bookings:checkin',
      'bookings:checkout',
      'bookings:confirm',
      'guests:read',
      'guests:create',
      'guests:update',
      'guests:pii:read',
    ],
  },
  {
    name: 'ACCOUNTANT',
    description: 'Manages invoices, payments, refunds, and financial records',
    scope: RoleScope.HOTEL,
    permissions: [
      'invoices:read',
      'invoices:create',
      'payments:read',
      'payments:process',
      'payments:refund',
      'reports:view',
      'ledger:read',
      'tax:manage',
      'bookings:read',
      'guests:read',
    ],
  },
  {
    name: 'HOUSEKEEPING_SUPERVISOR',
    description: 'Oversees housekeeping staff and task assignments',
    scope: RoleScope.HOTEL,
    permissions: [
      'rooms:read',
      'housekeeping:read',
      'housekeeping:assign',
      'housekeeping:update',
      'staff:read',
      'staff:manage',
      'shifts:read',
      'shifts:manage',
      'maintenance:read',
      'maintenance:create',
    ],
  },
  {
    name: 'HOUSEKEEPING_STAFF',
    description: 'Updates housekeeping task status',
    scope: RoleScope.HOTEL,
    permissions: ['rooms:read', 'housekeeping:read', 'housekeeping:update'],
  },
  {
    name: 'MAINTENANCE_STAFF',
    description: 'Handles maintenance tickets and repairs',
    scope: RoleScope.HOTEL,
    permissions: [
      'rooms:read',
      'maintenance:read',
      'maintenance:create',
      'maintenance:update',
    ],
  },
];

interface HotelConfig {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  location: string;
  region: string;
  timezone: string;
  currency: string;
  subdomain: string;
  rooms: number;
  plan: SubscriptionPlan;
  monthlyPrice: number;
  roomTypes: {
    name: string;
    description: string;
    baseCapacity: number;
    maxExtraBeds: number;
    basePrice: number;
  }[];
  roomsPerType: number;
}

const HOTELS: HotelConfig[] = [
  {
    name: 'The Grand Budapest Hotel',
    slug: 'budapest',
    ownerName: 'Gustave H.',
    ownerEmail: 'owner@budapest.hotel.com',
    location: 'Budapest, Hungary',
    region: 'europe-central',
    timezone: 'Europe/Budapest',
    currency: 'EUR',
    subdomain: 'budapest',
    rooms: 16,
    plan: SubscriptionPlan.ENTERPRISE,
    monthlyPrice: 999,
    roomTypes: [
      {
        name: 'Standard Room',
        description: 'Comfortable room with city view',
        baseCapacity: 2,
        maxExtraBeds: 0,
        basePrice: 199,
      },
      {
        name: 'Deluxe Room',
        description: 'Spacious room with garden view',
        baseCapacity: 2,
        maxExtraBeds: 1,
        basePrice: 299,
      },
      {
        name: 'Junior Suite',
        description: 'Elegant suite with sitting area',
        baseCapacity: 3,
        maxExtraBeds: 1,
        basePrice: 449,
      },
      {
        name: 'Penthouse Suite',
        description: 'Top-floor luxury with panoramic views',
        baseCapacity: 4,
        maxExtraBeds: 2,
        basePrice: 899,
      },
    ],
    roomsPerType: 4,
  },
  {
    name: 'Seaside Resort & Spa',
    slug: 'seaside',
    ownerName: 'Marina Blu',
    ownerEmail: 'owner@seaside.hotel.com',
    location: 'Miami, USA',
    region: 'us-east',
    timezone: 'America/New_York',
    currency: 'USD',
    subdomain: 'seaside',
    rooms: 12,
    plan: SubscriptionPlan.PROFESSIONAL,
    monthlyPrice: 299,
    roomTypes: [
      {
        name: 'Ocean View Room',
        description: 'Room overlooking the ocean',
        baseCapacity: 2,
        maxExtraBeds: 0,
        basePrice: 249,
      },
      {
        name: 'Beachfront Bungalow',
        description: 'Private bungalow steps from the beach',
        baseCapacity: 2,
        maxExtraBeds: 1,
        basePrice: 399,
      },
      {
        name: 'Family Suite',
        description: 'Large suite for the whole family',
        baseCapacity: 4,
        maxExtraBeds: 2,
        basePrice: 599,
      },
      {
        name: 'Presidential Villa',
        description: 'Ultimate luxury with private pool',
        baseCapacity: 6,
        maxExtraBeds: 3,
        basePrice: 1299,
      },
    ],
    roomsPerType: 3,
  },
  {
    name: 'Mountain View Lodge',
    slug: 'mountain',
    ownerName: 'Rocky Peaks',
    ownerEmail: 'owner@mountain.hotel.com',
    location: 'Aspen, USA',
    region: 'us-west',
    timezone: 'America/Denver',
    currency: 'USD',
    subdomain: 'mountain',
    rooms: 12,
    plan: SubscriptionPlan.PROFESSIONAL,
    monthlyPrice: 299,
    roomTypes: [
      {
        name: 'Rustic Cabin',
        description: 'Charming cabin with fireplace',
        baseCapacity: 2,
        maxExtraBeds: 0,
        basePrice: 149,
      },
      {
        name: 'Mountain Suite',
        description: 'Suite with mountain panorama',
        baseCapacity: 2,
        maxExtraBeds: 1,
        basePrice: 229,
      },
      {
        name: 'Family Cabin',
        description: 'Spacious cabin for families',
        baseCapacity: 4,
        maxExtraBeds: 2,
        basePrice: 349,
      },
      {
        name: 'Premium Chalet',
        description: 'Premium chalet with hot tub',
        baseCapacity: 6,
        maxExtraBeds: 2,
        basePrice: 699,
      },
    ],
    roomsPerType: 3,
  },
  {
    name: 'City Center Business Hotel',
    slug: 'business',
    ownerName: 'Sterling Grey',
    ownerEmail: 'owner@business.hotel.com',
    location: 'London, UK',
    region: 'europe-west',
    timezone: 'Europe/London',
    currency: 'GBP',
    subdomain: 'business',
    rooms: 16,
    plan: SubscriptionPlan.BASIC,
    monthlyPrice: 99,
    roomTypes: [
      {
        name: 'Business Single',
        description: 'Efficient room for solo travelers',
        baseCapacity: 1,
        maxExtraBeds: 0,
        basePrice: 179,
      },
      {
        name: 'Business Double',
        description: 'Comfortable room for two',
        baseCapacity: 2,
        maxExtraBeds: 0,
        basePrice: 229,
      },
      {
        name: 'Executive Room',
        description: 'Premium room with lounge access',
        baseCapacity: 2,
        maxExtraBeds: 1,
        basePrice: 349,
      },
      {
        name: 'Presidential Suite',
        description: 'Top-floor suite with boardroom',
        baseCapacity: 4,
        maxExtraBeds: 2,
        basePrice: 799,
      },
    ],
    roomsPerType: 4,
  },
];

const GUESTS = [
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '+1-555-0101',
  },
  {
    firstName: 'Emily',
    lastName: 'Johnson',
    email: 'emily.j@email.com',
    phone: '+1-555-0102',
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.brown@email.com',
    phone: '+1-555-0103',
  },
  {
    firstName: 'Sarah',
    lastName: 'Davis',
    email: 'sarah.davis@email.com',
    phone: '+1-555-0104',
  },
  {
    firstName: 'Robert',
    lastName: 'Wilson',
    email: 'robert.wilson@email.com',
    phone: '+1-555-0105',
  },
  {
    firstName: 'Jessica',
    lastName: 'Taylor',
    email: 'jessica.taylor@email.com',
    phone: '+1-555-0106',
  },
  {
    firstName: 'David',
    lastName: 'Anderson',
    email: 'david.anderson@email.com',
    phone: '+1-555-0107',
  },
  {
    firstName: 'Lisa',
    lastName: 'Thomas',
    email: 'lisa.thomas@email.com',
    phone: '+1-555-0108',
  },
];

function formatSchemaName(id: string): string {
  return `hotel_${id.replace(/-/g, '_')}`;
}

process.env.DB_SYNCHRONIZE = 'false';
process.env.OTEL_ENABLED = 'false';
process.env.DB_LOGGING = 'false';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('=== Hotel Booking System - Seed Script ===\n');

  try {
    const permissionRepo = dataSource.getRepository(Permission);
    const roleRepo = dataSource.getRepository(Role);
    const rolePermRepo = dataSource.getRepository(RolePermission);
    const userRepo = dataSource.getRepository(User);
    const hotelRepo = dataSource.getRepository(Hotel);
    const accessRepo = dataSource.getRepository(HotelUserAccess);
    const roomTypeRepo = dataSource.getRepository(RoomType);
    const roomRepo = dataSource.getRepository(Room);
    const guestRepo = dataSource.getRepository(Guest);
    const bookingRepo = dataSource.getRepository(Booking);
    const bookingRoomRepo = dataSource.getRepository(BookingRoom);
    const ratePlanRepo = dataSource.getRepository(RatePlan);
    const promotionRepo = dataSource.getRepository(Promotion);
    const seasonalRateRepo = dataSource.getRepository(SeasonalRate);
    const staffRepo = dataSource.getRepository(Staff);
    const shiftRepo = dataSource.getRepository(Shift);
    const housekeepingRepo = dataSource.getRepository(HousekeepingTask);
    const maintenanceRepo = dataSource.getRepository(MaintenanceTicket);
    const roomNightRepo = dataSource.getRepository(RoomNight);
    const invoiceRepo = dataSource.getRepository(Invoice);
    const paymentRepo = dataSource.getRepository(Payment);

    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    const today = new Date();

    console.log('1. Creating Permissions...');
    const savedPermissions: Record<string, Permission> = {};
    for (const p of PERMISSIONS) {
      let perm = await permissionRepo.findOne({ where: { code: p.code } });
      if (!perm) {
        perm = await permissionRepo.save(permissionRepo.create(p));
      }
      savedPermissions[p.code] = perm;
    }
    console.log(
      `   ${Object.keys(savedPermissions).length} permissions ready\n`,
    );

    console.log('2. Creating Roles...');
    const savedRoles: Record<string, Role> = {};
    for (const roleDef of ROLES) {
      let role = await roleRepo.findOne({ where: { name: roleDef.name } });
      if (!role) {
        role = await roleRepo.save(
          roleRepo.create({
            name: roleDef.name,
            description: roleDef.description,
            scope: roleDef.scope,
            isSystem: true,
            isActive: true,
            hierarchyLevel: roleDef.hierarchyLevel || 0,
          }),
        );
      }
      savedRoles[roleDef.name] = role;

      const allowedCodes = new Set(roleDef.permissions);
      for (const code of roleDef.permissions) {
        const perm = savedPermissions[code];
        if (!perm) continue;
        const exists = await rolePermRepo.findOne({
          where: { role: { id: role.id }, permission: { id: perm.id } },
        });
        if (!exists) {
          await rolePermRepo.save(
            rolePermRepo.create({
              role,
              permission: perm,
              grantedAt: new Date(),
            }),
          );
        }
      }

      const stale = await rolePermRepo.find({
        where: { role: { id: role.id } },
        relations: ['permission'],
      });
      for (const rp of stale) {
        if (!allowedCodes.has(rp.permission.code)) {
          await rolePermRepo.remove(rp);
        }
      }
    }
    console.log(`   ${Object.keys(savedRoles).length} roles ready\n`);

    console.log('3. Creating Super Admin...');
    const superAdminRole = savedRoles['SUPER_ADMIN'];
    let superAdmin = await userRepo.findOne({
      where: { email: 'admin@platform.com' },
    });
    if (!superAdmin) {
      superAdmin = await userRepo.save(
        userRepo.create({
          email: 'admin@platform.com',
          password: hashedPassword,
          firstName: 'System',
          lastName: 'Admin',
          scope: UserScope.PLATFORM,
          isActive: true,
          roleId: superAdminRole?.id,
        }),
      );
      console.log('   admin@platform.com / Admin123!');
    } else {
      console.log('   Super admin already exists');
    }

    console.log('\n4. Creating Hotel Admin (cross-hotel access)...');
    const hotelOwnerRole = savedRoles['HOTEL_OWNER'];
    let hotelAdmin = await userRepo.findOne({
      where: { email: 'admin@hotels.com' },
    });
    if (!hotelAdmin) {
      hotelAdmin = await userRepo.save(
        userRepo.create({
          email: 'admin@hotels.com',
          password: hashedPassword,
          firstName: 'Hotel',
          lastName: 'Admin',
          scope: UserScope.PLATFORM,
          isActive: true,
          roleId: hotelOwnerRole?.id,
        }),
      );
      console.log('   admin@hotels.com / Admin123!');
    } else {
      console.log('   Hotel admin already exists');
    }

    console.log('\n5. Creating Hotels & Related Data...');
    for (const hc of HOTELS) {
      console.log(`\n   === ${hc.name} ===`);

      const existingHotels: any[] = await dataSource.query(
        `SELECT * FROM global.hotels WHERE name = $1 LIMIT 1`,
        [hc.name],
      );
      let hotel: any = existingHotels[0];

      if (!hotel) {
        const tempId = crypto.randomUUID();
        const schemaName = formatSchemaName(tempId);
        // Only insert columns that exist in the Hotel entity
        await dataSource.query(
          `INSERT INTO global.hotels
             (id, name, "schemaName", status, subdomain, location, region, timezone, currency, rooms, "ownerName", "ownerEmail", "maintenanceMode", "storageUsedMb")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            tempId,
            hc.name,
            schemaName,
            HotelStatus.ACTIVE, // lowercase enum value: 'active'
            hc.subdomain,
            hc.location,
            hc.region,
            hc.timezone,
            hc.currency,
            hc.rooms,
            hc.ownerName,
            hc.ownerEmail,
            false,
            0,
          ],
        );
        hotel = { id: tempId, schemaName };
        console.log('      Created hotel record');
      } else {
        console.log('      Hotel already exists');
      }

      await dataSource.query(
        `CREATE SCHEMA IF NOT EXISTS "${hotel.schemaName}"`,
      );

      // Create / ensure subscription exists for this hotel
      const subscriptionRepo = dataSource.getRepository(Subscription);
      const existingSub = await subscriptionRepo.findOne({
        where: { hotel: { id: hotel.id }, status: SubscriptionStatus.ACTIVE },
      });
      if (!existingSub) {
        await subscriptionRepo.save(
          subscriptionRepo.create({
            hotel: { id: hotel.id } as Hotel,
            plan: hc.plan,
            price: hc.monthlyPrice,
            currency: hc.currency,
            startDate: new Date(),
            status: SubscriptionStatus.ACTIVE,
            features: {
              enabledFeatures: ['housekeeping', 'maintenance', 'analytics'],
              branding: { primaryColor: '#0F1B2D', accentColor: '#C9973A' },
            },
          }),
        );
        console.log(
          `      Subscription: ${hc.plan} @ ${hc.currency}${hc.monthlyPrice}/mo`,
        );
      }

      if (hotelAdmin) {
        const existingAccess = await accessRepo.findOne({
          where: { userId: hotelAdmin.id, hotelId: hotel.id },
        });
        if (!existingAccess && hotelOwnerRole) {
          await accessRepo.save(
            accessRepo.create({
              userId: hotelAdmin.id,
              hotelId: hotel.id,
              roleId: hotelOwnerRole.id,
              grantedAt: new Date(),
              status: HotelAccessStatus.ACTIVE,
            }),
          );
        }
      }

      console.log('      Room Types & Rooms...');
      const savedRoomTypes: Record<string, RoomType> = {};
      for (const rt of hc.roomTypes) {
        let roomType = await roomTypeRepo.findOne({ where: { name: rt.name } });
        if (!roomType) {
          roomType = await roomTypeRepo.save(roomTypeRepo.create(rt));
        }
        savedRoomTypes[rt.name] = roomType;
      }

      const floorNames = [
        'Ground',
        'First',
        'Second',
        'Third',
        'Fourth',
        'Fifth',
      ];
      const roomPrefix = hc.slug.toUpperCase().substring(0, 3);
      const savedRooms: Room[] = [];
      for (const [typeIdx, rt] of hc.roomTypes.entries()) {
        for (let i = 1; i <= hc.roomsPerType; i++) {
          const roomNumber = `${roomPrefix}-${String(typeIdx + 1).padStart(2, '0')}${String(i).padStart(2, '0')}`;
          const floor = floorNames[typeIdx] || 'Upper';
          let room = await roomRepo.findOne({ where: { roomNumber } });
          if (!room) {
            room = await roomRepo.save(
              roomRepo.create({
                roomNumber,
                floor,
                roomTypeId: savedRoomTypes[rt.name].id,
                status: RoomStatus.AVAILABLE,
              }),
            );
          }
          savedRooms.push(room);
        }
      }
      console.log(`      ${savedRooms.length} rooms created`);

      console.log('      Rate Plans...');
      const ratePlans = [
        {
          name: 'Standard Rate',
          description: 'Base rate',
          weekdayAdjustment: 0,
          weekendAdjustment: 0.15,
        },
        {
          name: 'Weekend Getaway',
          description: 'Weekend special',
          weekdayAdjustment: 0,
          weekendAdjustment: 0.1,
        },
        {
          name: 'Premium Rate',
          description: 'Premium service rate',
          weekdayAdjustment: 0.25,
          weekendAdjustment: 0.3,
        },
      ];
      for (const rpd of ratePlans) {
        for (const rt of Object.values(savedRoomTypes)) {
          const exists = await ratePlanRepo.findOne({
            where: { name: rpd.name, roomTypeId: rt.id },
          });
          if (!exists) {
            await ratePlanRepo.save(
              ratePlanRepo.create({ ...rpd, roomTypeId: rt.id }),
            );
          }
        }
      }

      console.log('      Promotions...');
      const promos = [
        {
          name: 'Spring Sale',
          description: 'Spring discount on all rooms',
          code: 'SPRING20',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          startDate: '2026-03-01',
          endDate: '2026-05-31',
          isActive: true,
        },
        {
          name: 'Early Bird',
          description: 'Early booking discount',
          code: 'EARLY15',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isActive: true,
        },
        {
          name: 'Last Minute',
          description: 'Last minute booking deal',
          code: 'LAST10',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isActive: true,
        },
      ];
      for (const pd of promos) {
        const exists = await promotionRepo.findOne({
          where: { name: pd.name },
        });
        if (!exists) {
          await promotionRepo.save(promotionRepo.create(pd));
        }
      }

      console.log('      Seasonal Rates...');
      for (const rt of Object.values(savedRoomTypes)) {
        const exists = await seasonalRateRepo.findOne({
          where: { roomTypeId: rt.id },
        });
        if (!exists) {
          await seasonalRateRepo.save(
            seasonalRateRepo.create({
              name: 'Summer Peak',
              roomTypeId: rt.id,
              startDate: '2026-06-01',
              endDate: '2026-08-31',
              multiplier: 1.3,
              priority: 1,
              isActive: true,
            }),
          );
        }
      }

      console.log('      Guests...');
      const savedGuests: Guest[] = [];
      const numGuests = Math.min(GUESTS.length, 6);
      for (let i = 0; i < numGuests; i++) {
        const g = GUESTS[i];
        const hotelEmail = `${hc.slug}.${g.email}`;
        let guest = await guestRepo.findOne({ where: { email: hotelEmail } });
        if (!guest) {
          guest = await guestRepo.save(
            guestRepo.create({ ...g, email: hotelEmail }),
          );
        }
        savedGuests.push(guest);
      }

      console.log('      Staff & Shifts...');
      const staffDefs = [
        {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: `alice.j@${hc.slug}.com`,
          role: StaffRole.FRONT_DESK,
          department: 'Front Office',
        },
        {
          firstName: 'Bob',
          lastName: 'Williams',
          email: `bob.w@${hc.slug}.com`,
          role: StaffRole.HOUSEKEEPING_SUPERVISOR,
          department: 'Housekeeping',
        },
        {
          firstName: 'Carol',
          lastName: 'Martinez',
          email: `carol.m@${hc.slug}.com`,
          role: StaffRole.HOUSEKEEPING_STAFF,
          department: 'Housekeeping',
        },
        {
          firstName: 'Dan',
          lastName: 'Brown',
          email: `dan.b@${hc.slug}.com`,
          role: StaffRole.MAINTENANCE_STAFF,
          department: 'Maintenance',
        },
      ];
      const savedStaff: Staff[] = [];
      for (const sd of staffDefs) {
        let staff = await staffRepo.findOne({ where: { email: sd.email } });
        if (!staff) {
          staff = await staffRepo.save(
            staffRepo.create({
              userId: crypto.randomUUID(),
              firstName: sd.firstName,
              lastName: sd.lastName,
              email: sd.email,
              role: sd.role,
              employmentType: EmploymentType.FULL_TIME,
              status: StaffStatus.ACTIVE,
              hourlyRate: 22.5,
              department: sd.department,
            }),
          );
        }
        savedStaff.push(staff);
      }

      for (const staff of savedStaff) {
        const shiftDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        );
        const startTime = new Date(shiftDate.getTime() + 8 * 3600000);
        const endTime = new Date(shiftDate.getTime() + 16 * 3600000);
        const exists = await shiftRepo.findOne({
          where: { staffId: staff.id, startTime },
        });
        if (!exists) {
          await shiftRepo.save(
            shiftRepo.create({
              staffId: staff.id,
              startTime,
              endTime,
              status: ShiftStatus.SCHEDULED,
            }),
          );
        }
      }

      console.log('      Housekeeping Tasks...');
      for (let i = 0; i < Math.min(3, savedRooms.length); i++) {
        const room = savedRooms[i];
        const exists = await housekeepingRepo.findOne({
          where: { roomId: room.id, status: TaskStatus.PENDING },
        });
        if (!exists) {
          await housekeepingRepo.save(
            housekeepingRepo.create({
              roomId: room.id,
              assignedTo: savedStaff[1]?.id,
              status: TaskStatus.PENDING,
              priority: TaskPriority.MEDIUM,
              description: `Routine cleaning for room ${room.roomNumber}`,
              scheduledDate: today.toISOString().split('T')[0],
            }),
          );
        }
      }

      console.log('      Maintenance Tickets...');
      if (savedRooms.length > 1) {
        const room = savedRooms[1];
        const exists = await maintenanceRepo.findOne({
          where: { roomId: room.id, status: TicketStatus.REPORTED },
        });
        if (!exists) {
          await maintenanceRepo.save(
            maintenanceRepo.create({
              roomId: room.id,
              reportedBy: savedStaff[3]?.id ?? crypto.randomUUID(),
              assignedTo: savedStaff[3]?.id,
              title: 'AC not cooling properly',
              description:
                'Guest reported that the air conditioning is not cooling effectively.',
              status: TicketStatus.REPORTED,
              priority: TicketPriority.HIGH,
              category: 'HVAC',
            }),
          );
        }
      }

      console.log('      Bookings, Invoices & Payments...');
      if (savedGuests.length >= 2) {
        const pastCheckIn = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 5,
        );
        const pastCheckOut = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 3,
        );
        const guest1 = savedGuests[0];
        const room1 = savedRooms[0];
        const pastBasePrice =
          savedRoomTypes[hc.roomTypes[0].name]?.basePrice || 199;

        let pastBooking = await bookingRepo.findOne({
          where: { guestId: guest1.id, status: BookingStatus.CHECKED_OUT },
        });
        if (!pastBooking && guest1 && room1) {
          pastBooking = await bookingRepo.save(
            bookingRepo.create({
              guestId: guest1.id,
              checkIn: pastCheckIn,
              checkOut: pastCheckOut,
              status: BookingStatus.CHECKED_OUT,
              totalPrice: pastBasePrice * 2,
              idempotencyKey: `past_${crypto.randomUUID()}`,
            }),
          );

          await bookingRoomRepo.save(
            bookingRoomRepo.create({
              bookingId: pastBooking.id,
              roomId: room1.id,
              price: pastBasePrice * 2,
              nightPrices: [
                {
                  date: pastCheckIn.toISOString().split('T')[0],
                  price: pastBasePrice,
                },
                {
                  date: new Date(pastCheckIn.getTime() + 86400000)
                    .toISOString()
                    .split('T')[0],
                  price: pastBasePrice,
                },
              ],
            }),
          );

          for (let d = 0; d < 2; d++) {
            const date = new Date(pastCheckIn.getTime() + d * 86400000)
              .toISOString()
              .split('T')[0];
            await roomNightRepo.save(
              roomNightRepo.create({
                roomId: room1.id,
                date,
                status: RoomNightStatus.BOOKED,
                bookingId: pastBooking.id,
                price: pastBasePrice,
              }),
            );
          }

          const inv = await invoiceRepo.save(
            invoiceRepo.create({
              invoiceNumber: `INV-${hc.slug}-${Date.now()}-001`,
              bookingId: pastBooking.id,
              amount: pastBasePrice * 2,
              subtotal: pastBasePrice * 2,
              taxTotal: 0,
              status: InvoiceStatus.PAID,
              lineItems: [
                {
                  description: 'Room charge (2 nights)',
                  quantity: 2,
                  unitPrice: pastBasePrice,
                  total: pastBasePrice * 2,
                },
              ],
              dueDate: pastCheckIn,
              paidAt: pastCheckIn,
            }),
          );

          await paymentRepo.save(
            paymentRepo.create({
              invoiceId: inv.id,
              bookingId: pastBooking.id,
              amount: pastBasePrice * 2,
              fee: 0,
              netAmount: pastBasePrice * 2,
              method: PaymentMethod.CREDIT_CARD,
              status: PaymentStatus.COMPLETED,
              transactionId: `TXN-${Date.now()}-past-${hc.slug}`,
              description: 'Payment for past booking',
              paidAt: pastCheckIn,
            }),
          );
        }

        const currentCheckIn = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 1,
        );
        const currentCheckOut = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 2,
        );
        const guest2 = savedGuests[1];
        const currentBasePrice =
          savedRoomTypes[hc.roomTypes[0].name]?.basePrice || 199;
        const currentRoom = savedRooms[Math.min(1, savedRooms.length - 1)];

        let currentBooking = await bookingRepo.findOne({
          where: { guestId: guest2.id, status: BookingStatus.CHECKED_IN },
        });
        if (!currentBooking && guest2 && currentRoom) {
          currentBooking = await bookingRepo.save(
            bookingRepo.create({
              guestId: guest2.id,
              checkIn: currentCheckIn,
              checkOut: currentCheckOut,
              status: BookingStatus.CHECKED_IN,
              totalPrice: currentBasePrice * 3,
              idempotencyKey: `current_${crypto.randomUUID()}`,
            }),
          );

          await bookingRoomRepo.save(
            bookingRoomRepo.create({
              bookingId: currentBooking.id,
              roomId: currentRoom.id,
              price: currentBasePrice * 3,
              nightPrices: [
                {
                  date: currentCheckIn.toISOString().split('T')[0],
                  price: currentBasePrice,
                },
                {
                  date: new Date(currentCheckIn.getTime() + 86400000)
                    .toISOString()
                    .split('T')[0],
                  price: currentBasePrice,
                },
                {
                  date: new Date(currentCheckIn.getTime() + 2 * 86400000)
                    .toISOString()
                    .split('T')[0],
                  price: currentBasePrice,
                },
              ],
            }),
          );

          for (let d = 0; d < 3; d++) {
            const date = new Date(currentCheckIn.getTime() + d * 86400000)
              .toISOString()
              .split('T')[0];
            await roomNightRepo.save(
              roomNightRepo.create({
                roomId: currentRoom.id,
                date,
                status: RoomNightStatus.BOOKED,
                bookingId: currentBooking.id,
                price: currentBasePrice,
              }),
            );
          }
        }

        if (savedGuests.length >= 3) {
          const futureCheckIn = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 14,
          );
          const futureCheckOut = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 17,
          );
          const guest3 = savedGuests[2];
          const futureBasePrice =
            savedRoomTypes[hc.roomTypes[0].name]?.basePrice || 199;
          const futureRoom = savedRooms[Math.min(2, savedRooms.length - 1)];

          let futureBooking = await bookingRepo.findOne({
            where: { guestId: guest3.id, status: BookingStatus.CONFIRMED },
          });
          if (!futureBooking && guest3 && futureRoom) {
            futureBooking = await bookingRepo.save(
              bookingRepo.create({
                guestId: guest3.id,
                checkIn: futureCheckIn,
                checkOut: futureCheckOut,
                status: BookingStatus.CONFIRMED,
                totalPrice: futureBasePrice * 3,
                idempotencyKey: `future_${crypto.randomUUID()}`,
              }),
            );

            await bookingRoomRepo.save(
              bookingRoomRepo.create({
                bookingId: futureBooking.id,
                roomId: futureRoom.id,
                price: futureBasePrice * 3,
                nightPrices: [
                  {
                    date: futureCheckIn.toISOString().split('T')[0],
                    price: futureBasePrice,
                  },
                  {
                    date: new Date(futureCheckIn.getTime() + 86400000)
                      .toISOString()
                      .split('T')[0],
                    price: futureBasePrice,
                  },
                  {
                    date: new Date(futureCheckIn.getTime() + 2 * 86400000)
                      .toISOString()
                      .split('T')[0],
                    price: futureBasePrice,
                  },
                ],
              }),
            );
          }
        }
      }

      console.log('      Hotel Users...');
      for (const roleDef of ROLES) {
        const email = `${roleDef.name.toLowerCase()}@${hc.slug}.com`;
        let testUser = await userRepo.findOne({ where: { email } });
        if (!testUser) {
          testUser = await userRepo.save(
            userRepo.create({
              email,
              password: hashedPassword,
              firstName: roleDef.name
                .split('_')
                .map(
                  (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
                )
                .join(' '),
              lastName: hc.name.split(' ').slice(0, 2).join(' '),
              scope: UserScope.HOTEL,
              isActive: true,
            }),
          );
        }

        let access = await accessRepo.findOne({
          where: { userId: testUser.id, hotelId: hotel.id },
        });
        if (!access) {
          const role = savedRoles[roleDef.name];
          if (role) {
            await accessRepo.save(
              accessRepo.create({
                userId: testUser.id,
                hotelId: hotel.id,
                roleId: role.id,
                grantedAt: new Date(),
                status: HotelAccessStatus.ACTIVE,
              }),
            );
          }
        }
      }
    }

    console.log('\n6. Summary');
    console.log('   Super Admin: admin@platform.com / Admin123!');
    console.log('   Hotel Admin: admin@hotels.com / Admin123!');
    for (const hc of HOTELS) {
      console.log(`\n   ${hc.name}:`);
      for (const roleDef of ROLES) {
        console.log(
          `     ${roleDef.name}: ${roleDef.name.toLowerCase()}@${hc.slug}.com / Admin123!`,
        );
      }
    }
    console.log('\n=== Seed Complete! ===\n');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
