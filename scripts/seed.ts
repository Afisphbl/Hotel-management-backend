import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserScope } from '../src/database/entities/user.entity';
import { Permission } from '../src/database/entities/permission.entity';
import { Role } from '../src/database/entities/role.entity';
import { RolePermission } from '../src/database/entities/role-permission.entity';
import { Hotel, HotelStatus } from '../src/database/entities/hotel.entity';
import { HotelUserAccess } from '../src/database/entities/hotel-user-access.entity';
import * as bcrypt from 'bcrypt';

interface RoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

const PERMISSIONS = [
  // Room Management
  { slug: 'rooms:read', description: 'View rooms' },
  { slug: 'rooms:create', description: 'Add new rooms' },
  { slug: 'rooms:update', description: 'Edit room details' },
  { slug: 'rooms:delete', description: 'Remove rooms' },
  { slug: 'rooms:status', description: 'Change room status' },

  // Room Types
  { slug: 'room_types:read', description: 'View room types' },
  { slug: 'room_types:create', description: 'Add room types' },
  { slug: 'room_types:update', description: 'Edit room types' },
  { slug: 'room_types:delete', description: 'Delete room types' },

  // Bookings
  { slug: 'bookings:read', description: 'View bookings' },
  { slug: 'bookings:create', description: 'Create bookings' },
  { slug: 'bookings:update', description: 'Modify bookings' },
  { slug: 'bookings:cancel', description: 'Cancel bookings' },
  { slug: 'bookings:checkin', description: 'Check-in guests' },
  { slug: 'bookings:checkout', description: 'Check-out guests' },
  { slug: 'bookings:confirm', description: 'Confirm booking holds' },

  // Guests
  { slug: 'guests:read', description: 'View guest profiles' },
  { slug: 'guests:create', description: 'Create guest profiles' },
  { slug: 'guests:update', description: 'Edit guest profiles' },
  { slug: 'guests:delete', description: 'Delete guest profiles' },
  { slug: 'guests:pii:read', description: 'View guest PII data' },

  // Pricing
  { slug: 'pricing:read', description: 'View pricing' },
  { slug: 'pricing:manage', description: 'Manage rate plans' },
  { slug: 'pricing:promotions', description: 'Manage promotions' },
  { slug: 'pricing:overrides', description: 'Manage price overrides' },
  { slug: 'pricing:seasonal', description: 'Manage seasonal rates' },

  // Finance
  { slug: 'invoices:read', description: 'View invoices' },
  { slug: 'invoices:create', description: 'Generate invoices' },
  { slug: 'payments:read', description: 'View payments' },
  { slug: 'payments:process', description: 'Process payments' },
  { slug: 'payments:refund', description: 'Process refunds' },
  { slug: 'reports:view', description: 'View financial reports' },
  { slug: 'ledger:read', description: 'View ledger entries' },
  { slug: 'tax:manage', description: 'Manage tax rules' },

  // Housekeeping
  { slug: 'housekeeping:read', description: 'View housekeeping tasks' },
  { slug: 'housekeeping:assign', description: 'Assign housekeeping tasks' },
  { slug: 'housekeeping:update', description: 'Update housekeeping task status' },

  // Maintenance
  { slug: 'maintenance:read', description: 'View maintenance tickets' },
  { slug: 'maintenance:create', description: 'Create maintenance tickets' },
  { slug: 'maintenance:update', description: 'Update maintenance tickets' },
  { slug: 'maintenance:resolve', description: 'Resolve maintenance tickets' },

  // Staff
  { slug: 'staff:read', description: 'View staff members' },
  { slug: 'staff:manage', description: 'Manage staff profiles' },

  // Shifts
  { slug: 'shifts:read', description: 'View shift schedules' },
  { slug: 'shifts:manage', description: 'Manage shift assignments' },

  // Hotel Settings
  { slug: 'hotel:settings', description: 'Manage hotel settings' },
];

const ROLES: RoleDefinition[] = [
  {
    name: 'HOTEL_OWNER',
    description: 'Full access to all hotel operations',
    permissions: PERMISSIONS.map(p => p.slug),
  },
  {
    name: 'HOTEL_MANAGER',
    description: 'Day-to-day hotel management access',
    permissions: [
      'rooms:read', 'rooms:create', 'rooms:update', 'rooms:status',
      'room_types:read', 'room_types:create', 'room_types:update',
      'bookings:read', 'bookings:create', 'bookings:update', 'bookings:cancel',
      'bookings:checkin', 'bookings:checkout', 'bookings:confirm',
      'guests:read', 'guests:create', 'guests:update',
      'pricing:read', 'pricing:manage', 'pricing:promotions', 'pricing:overrides', 'pricing:seasonal',
      'invoices:read',
      'payments:read',
      'reports:view',
      'housekeeping:read', 'housekeeping:assign',
      'maintenance:read', 'maintenance:create', 'maintenance:update',
      'staff:read',
      'shifts:read', 'shifts:manage',
      'hotel:settings',
    ],
  },
  {
    name: 'REVENUE_MANAGER',
    description: 'Manages pricing, rate plans, and revenue reporting',
    permissions: [
      'rooms:read',
      'room_types:read',
      'bookings:read',
      'pricing:read', 'pricing:manage', 'pricing:promotions', 'pricing:overrides', 'pricing:seasonal',
      'reports:view',
      'invoices:read',
    ],
  },
  {
    name: 'FRONT_DESK',
    description: 'Handles guest check-in/out and daily booking operations',
    permissions: [
      'rooms:read', 'rooms:status',
      'room_types:read',
      'bookings:read', 'bookings:create', 'bookings:update', 'bookings:cancel',
      'bookings:checkin', 'bookings:checkout', 'bookings:confirm',
      'guests:read', 'guests:create', 'guests:update',
      'guests:pii:read',
    ],
  },
  {
    name: 'ACCOUNTANT',
    description: 'Manages invoices, payments, refunds, and financial records',
    permissions: [
      'invoices:read', 'invoices:create',
      'payments:read', 'payments:process', 'payments:refund',
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
    permissions: [
      'rooms:read',
      'housekeeping:read', 'housekeeping:assign', 'housekeeping:update',
      'staff:read', 'staff:manage',
      'shifts:read', 'shifts:manage',
      'maintenance:read', 'maintenance:create',
    ],
  },
  {
    name: 'HOUSEKEEPING_STAFF',
    description: 'Updates housekeeping task status',
    permissions: [
      'rooms:read',
      'housekeeping:read', 'housekeeping:update',
    ],
  },
  {
    name: 'MAINTENANCE_STAFF',
    description: 'Handles maintenance tickets and repairs',
    permissions: [
      'rooms:read',
      'maintenance:read', 'maintenance:create', 'maintenance:update',
    ],
  },
];

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Seeding database...');

  try {
    const permissionRepo = dataSource.getRepository(Permission);

    // 1. Create all permissions
    const savedPermissions: Record<string, Permission> = {};
    for (const p of PERMISSIONS) {
      let perm = await permissionRepo.findOne({ where: { slug: p.slug } });
      if (!perm) {
        perm = await permissionRepo.save(permissionRepo.create(p));
      }
      savedPermissions[p.slug] = perm;
    }
    console.log(`Created ${Object.keys(savedPermissions).length} permissions`);

    // 2. Create Super Admin
    const userRepo = dataSource.getRepository(User);
    const adminEmail = 'admin@platform.com';
    let admin = await userRepo.findOne({ where: { email: adminEmail } });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      admin = await userRepo.save(userRepo.create({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        scope: UserScope.PLATFORM,
        isActive: true,
      }));
      console.log(`Created Super Admin: ${adminEmail}`);
    }

    // 3. Create Sample Hotel
    const hotelRepo = dataSource.getRepository(Hotel);
    let hotel = await hotelRepo.findOne({ where: { name: 'The Grand Budapest Hotel' } });
    if (!hotel) {
      const tempId = '00000000-0000-0000-0000-000000000001';
      hotel = await hotelRepo.save(hotelRepo.create({
        id: tempId,
        name: 'The Grand Budapest Hotel',
        schemaName: `hotel_${tempId.replace(/-/g, '_')}`,
        status: HotelStatus.ACTIVE,
      }));
      console.log(`Created Hotel: ${hotel.name} (${hotel.id})`);
    }

    if (!hotel) throw new Error('Failed to create hotel');

    // 4. Create Tenant Schema
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${hotel.schemaName}`);
    console.log(`Created Schema: ${hotel.schemaName}`);

    // 5. Create all hotel roles with their permissions
    const roleRepo = dataSource.getRepository(Role);
    const rolePermRepo = dataSource.getRepository(RolePermission);

    const createdRoles: Record<string, { role: Role; user: User }> = {};

    for (const roleDef of ROLES) {
      let role = await roleRepo.findOne({ where: { name: roleDef.name } });
      if (!role) {
        role = await roleRepo.save(roleRepo.create({
          name: roleDef.name,
          description: roleDef.description,
          isSystemRole: true,
        }));
        console.log(`Created Role: ${roleDef.name}`);

        // Link permissions
        for (const slug of roleDef.permissions) {
          const perm = savedPermissions[slug];
          if (!perm) {
            console.warn(`  Warning: permission "${slug}" not found for role "${roleDef.name}"`);
            continue;
          }
          const exists = await rolePermRepo.findOne({
            where: { roleId: role.id, permissionId: perm.id },
          });
          if (!exists) {
            await rolePermRepo.save(rolePermRepo.create({
              roleId: role.id,
              permissionId: perm.id,
            }));
          }
        }
      } else {
        console.log(`Role already exists: ${roleDef.name}`);
      }

      // Create a test user for each role
      const email = `${roleDef.name.toLowerCase()}@grandbudapest.com`;
      let testUser = await userRepo.findOne({ where: { email } });
      if (!testUser) {
        const hashedPassword = await bcrypt.hash('Test123!', 10);
        testUser = await userRepo.save(userRepo.create({
          email,
          password: hashedPassword,
          firstName: roleDef.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
          lastName: 'User',
          scope: UserScope.HOTEL,
          isActive: true,
        }));
        console.log(`  Created user: ${email}`);
      }

      // Grant access to hotel
      const accessRepo = dataSource.getRepository(HotelUserAccess);
      let access = await accessRepo.findOne({ where: { userId: testUser.id, hotelId: hotel.id } });
      if (!access) {
        await accessRepo.save(accessRepo.create({
          userId: testUser.id,
          hotelId: hotel.id,
          roleId: role!.id,
        }));
        console.log(`  Granted ${roleDef.name} access to hotel`);
      }

      createdRoles[roleDef.name] = { role: role!, user: testUser };
    }

    console.log('\nSeeding completed successfully!');
    console.log('\n--- Platform Admin ---');
    console.log(`  ${adminEmail} / Admin123!`);
    console.log('\n--- Hotel Users (The Grand Budapest Hotel) ---');
    console.log(`  Hotel ID: ${hotel.id}`);
    for (const [name, { user }] of Object.entries(createdRoles)) {
      console.log(`  ${name}: ${user.email} / Test123!`);
    }
    console.log('');

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
