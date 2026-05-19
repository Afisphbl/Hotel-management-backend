import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserScope } from '../src/database/entities/user.entity';
import { Permission } from '../src/database/entities/permission.entity';
import { Role } from '../src/database/entities/role.entity';
import { RolePermission } from '../src/database/entities/role-permission.entity';
import { Hotel, HotelStatus } from '../src/database/entities/hotel.entity';
import { HotelUserAccess } from '../src/database/entities/hotel-user-access.entity';
import { RoomType } from '../src/database/entities/room-type.entity';
import { Room, RoomStatus } from '../src/database/entities/room.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PERMISSIONS = [
  { slug: 'rooms:read', description: 'View rooms' },
  { slug: 'rooms:create', description: 'Add new rooms' },
  { slug: 'rooms:update', description: 'Edit room details' },
  { slug: 'rooms:delete', description: 'Remove rooms' },
  { slug: 'rooms:status', description: 'Change room status' },
  { slug: 'room_types:read', description: 'View room types' },
  { slug: 'room_types:create', description: 'Add room types' },
  { slug: 'room_types:update', description: 'Edit room types' },
  { slug: 'room_types:delete', description: 'Delete room types' },
  { slug: 'bookings:read', description: 'View bookings' },
  { slug: 'bookings:create', description: 'Create bookings' },
  { slug: 'bookings:update', description: 'Modify bookings' },
  { slug: 'bookings:cancel', description: 'Cancel bookings' },
  { slug: 'bookings:checkin', description: 'Check-in guests' },
  { slug: 'bookings:checkout', description: 'Check-out guests' },
  { slug: 'bookings:confirm', description: 'Confirm booking holds' },
  { slug: 'guests:read', description: 'View guest profiles' },
  { slug: 'guests:create', description: 'Create guest profiles' },
  { slug: 'guests:update', description: 'Edit guest profiles' },
  { slug: 'guests:delete', description: 'Delete guest profiles' },
  { slug: 'guests:pii:read', description: 'View guest PII data' },
  { slug: 'pricing:read', description: 'View pricing' },
  { slug: 'pricing:manage', description: 'Manage rate plans' },
  { slug: 'pricing:promotions', description: 'Manage promotions' },
  { slug: 'pricing:overrides', description: 'Manage price overrides' },
  { slug: 'pricing:seasonal', description: 'Manage seasonal rates' },
  { slug: 'invoices:read', description: 'View invoices' },
  { slug: 'invoices:create', description: 'Generate invoices' },
  { slug: 'payments:read', description: 'View payments' },
  { slug: 'payments:process', description: 'Process payments' },
  { slug: 'payments:refund', description: 'Process refunds' },
  { slug: 'reports:view', description: 'View financial reports' },
  { slug: 'ledger:read', description: 'View ledger entries' },
  { slug: 'tax:manage', description: 'Manage tax rules' },
  { slug: 'housekeeping:read', description: 'View housekeeping tasks' },
  { slug: 'housekeeping:assign', description: 'Assign housekeeping tasks' },
  {
    slug: 'housekeeping:update',
    description: 'Update housekeeping task status',
  },
  { slug: 'maintenance:read', description: 'View maintenance tickets' },
  { slug: 'maintenance:create', description: 'Create maintenance tickets' },
  { slug: 'maintenance:update', description: 'Update maintenance tickets' },
  { slug: 'maintenance:resolve', description: 'Resolve maintenance tickets' },
  { slug: 'staff:read', description: 'View staff members' },
  { slug: 'staff:manage', description: 'Manage staff profiles' },
  { slug: 'shifts:read', description: 'View shift schedules' },
  { slug: 'shifts:manage', description: 'Manage shift assignments' },
  { slug: 'hotel:settings', description: 'Manage hotel settings' },
];

const ROLES = [
  {
    name: 'HOTEL_OWNER',
    description: 'Full access to all hotel operations',
    permissions: PERMISSIONS.map((p) => p.slug),
  },
  {
    name: 'HOTEL_MANAGER',
    description: 'Day-to-day hotel management access',
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
    permissions: ['rooms:read', 'housekeeping:read', 'housekeeping:update'],
  },
  {
    name: 'MAINTENANCE_STAFF',
    description: 'Handles maintenance tickets and repairs',
    permissions: [
      'rooms:read',
      'maintenance:read',
      'maintenance:create',
      'maintenance:update',
    ],
  },
];

interface CustomRoomType {
  name: string;
  description: string;
  baseCapacity: number;
  maxExtraBeds: number;
  basePrice: number;
}

interface CustomHotelUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleName: string;
}

interface CustomHotelConfig {
  name: string;
  slug: string;
  roomTypes: CustomRoomType[];
  roomsPerType: number;
  users: CustomHotelUser[];
}

interface CustomSeedData {
  superAdmin: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  };
  hotels: CustomHotelConfig[];
}

function formatSchemaName(id: string): string {
  return `hotel_${id.replace(/-/g, '_')}`;
}

async function bootstrap() {
  console.log('=== Hotel Booking System - Custom Seed Script ===\n');

  // Load custom-seed.json or fallback to template
  const configPath = path.join(__dirname, 'custom-seed.json');
  const templatePath = path.join(__dirname, 'custom-seed-template.json');

  if (!fs.existsSync(configPath)) {
    console.log(
      `Config file "custom-seed.json" not found. Creating it from template...`,
    );
    fs.copyFileSync(templatePath, configPath);
  }

  const customData = JSON.parse(
    fs.readFileSync(configPath, 'utf-8'),
  ) as CustomSeedData;

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // ──────────────────────────────────────────────
    // 1. PERMISSIONS
    // ──────────────────────────────────────────────
    console.log('--- Creating Permissions ---');
    const permissionRepo = dataSource.getRepository(Permission);
    const savedPermissions: Record<string, Permission> = {};
    for (const p of PERMISSIONS) {
      let perm = await permissionRepo.findOne({ where: { slug: p.slug } });
      if (!perm) {
        perm = await permissionRepo.save(permissionRepo.create(p));
      }
      savedPermissions[p.slug] = perm;
    }
    console.log(
      `  ${Object.keys(savedPermissions).length} permissions ready\n`,
    );

    // ──────────────────────────────────────────────
    // 2. ROLES
    // ──────────────────────────────────────────────
    console.log('--- Creating System Roles ---');
    const roleRepo = dataSource.getRepository(Role);
    const rolePermRepo = dataSource.getRepository(RolePermission);
    const savedRoles: Record<string, Role> = {};

    for (const roleDef of ROLES) {
      let role = await roleRepo.findOne({ where: { name: roleDef.name } });
      if (!role) {
        role = await roleRepo.save(
          roleRepo.create({
            name: roleDef.name,
            description: roleDef.description,
            isSystemRole: true,
          }),
        );
      }
      savedRoles[roleDef.name] = role;

      for (const slug of roleDef.permissions) {
        const perm = savedPermissions[slug];
        if (!perm) continue;
        const exists = await rolePermRepo.findOne({
          where: { roleId: role.id, permissionId: perm.id },
        });
        if (!exists) {
          await rolePermRepo.save(
            rolePermRepo.create({ roleId: role.id, permissionId: perm.id }),
          );
        }
      }
    }
    console.log(`  ${Object.keys(savedRoles).length} roles ready\n`);

    // ──────────────────────────────────────────────
    // 3. SEED SUPER ADMIN
    // ──────────────────────────────────────────────
    console.log('--- Seeding Platform Super Admin ---');
    const userRepo = dataSource.getRepository(User);
    const sa = customData.superAdmin;
    if (!sa || !sa.email || !sa.password) {
      throw new Error('Super admin definition missing in custom-seed.json');
    }

    let superAdminUser = await userRepo.findOne({ where: { email: sa.email } });
    if (!superAdminUser) {
      const hashedPassword = await bcrypt.hash(sa.password, 10);
      superAdminUser = await userRepo.save(
        userRepo.create({
          email: sa.email,
          password: hashedPassword,
          firstName: sa.firstName || 'Super',
          lastName: sa.lastName || 'Admin',
          scope: UserScope.PLATFORM,
          isActive: true,
        }),
      );
      console.log(`  Created Super Admin: ${sa.email}`);
    } else {
      console.log(`  Super Admin already exists: ${sa.email}`);
    }

    // ──────────────────────────────────────────────
    // 4. HOTELS + SCHEMAS + USERS + ROOMS
    // ──────────────────────────────────────────────
    const hotelRepo = dataSource.getRepository(Hotel);
    const accessRepo = dataSource.getRepository(HotelUserAccess);
    const roomTypeRepo = dataSource.getRepository(RoomType);
    const roomRepoLocal = dataSource.getRepository(Room);

    if (customData.hotels && Array.isArray(customData.hotels)) {
      for (const hc of customData.hotels) {
        console.log(`\n=== Hotel: ${hc.name} ===`);

        // Check or create hotel
        let hotel = await hotelRepo.findOne({ where: { name: hc.name } });
        if (!hotel) {
          const tempId = crypto.randomUUID();
          hotel = await hotelRepo.save(
            hotelRepo.create({
              id: tempId,
              name: hc.name,
              schemaName: formatSchemaName(tempId),
              status: HotelStatus.ACTIVE,
            }),
          );
          console.log(`  Created Hotel and metadata`);
        } else {
          console.log(`  Hotel record already exists`);
        }

        // Schema isolation creation
        await dataSource.query(
          `CREATE SCHEMA IF NOT EXISTS "${hotel.schemaName}"`,
        );
        console.log(`  Schema initialized/active: ${hotel.schemaName}`);

        // Seed Room Types & Rooms so the system works
        console.log('  Seeding Room Types & Rooms...');
        const savedRoomTypes: Record<string, RoomType> = {};
        for (const rt of hc.roomTypes || []) {
          let roomType = await roomTypeRepo.findOne({
            where: { name: rt.name },
          });
          if (!roomType) {
            roomType = await roomTypeRepo.save(roomTypeRepo.create(rt));
          }
          savedRoomTypes[rt.name] = roomType;
        }

        const floorNames = [
          'Ground Floor',
          'First Floor',
          'Second Floor',
          'Third Floor',
        ];
        const roomsPerType = hc.roomsPerType || 3;
        const roomPrefix = hc.slug
          ? hc.slug.toUpperCase().substring(0, 3)
          : 'RM';
        let roomCount = 0;

        for (const [typeIdx, rtName] of Object.keys(savedRoomTypes).entries()) {
          for (let i = 1; i <= roomsPerType; i++) {
            const roomNumber = `${roomPrefix}-${String(typeIdx + 1).padStart(2, '0')}${String(i).padStart(2, '0')}`;
            const floor = floorNames[typeIdx] || 'Upper Floor';
            let room = await roomRepoLocal.findOne({ where: { roomNumber } });
            if (!room) {
              room = await roomRepoLocal.save(
                roomRepoLocal.create({
                  roomNumber,
                  floor,
                  roomTypeId: savedRoomTypes[rtName].id,
                  status: RoomStatus.AVAILABLE,
                }),
              );
              roomCount++;
            }
          }
        }
        console.log(`  Generated ${roomCount} room units for booking`);

        // Seed designated users
        console.log('  Seeding Hotel Users...');
        for (const u of hc.users || []) {
          let hotelUser = await userRepo.findOne({ where: { email: u.email } });
          if (!hotelUser) {
            const hashedPwd = await bcrypt.hash(u.password, 10);
            hotelUser = await userRepo.save(
              userRepo.create({
                email: u.email,
                password: hashedPwd,
                firstName: u.firstName,
                lastName: u.lastName,
                scope: UserScope.HOTEL,
                isActive: true,
              }),
            );
            console.log(`    Created user: ${u.email} (${u.roleName})`);
          } else {
            console.log(`    User already exists: ${u.email}`);
          }

          // Link to hotel with the given role
          const role = savedRoles[u.roleName];
          if (!role) {
            console.error(`    Role "${u.roleName}" not found in system!`);
            continue;
          }

          const access = await accessRepo.findOne({
            where: { userId: hotelUser.id, hotelId: hotel.id },
          });
          if (!access) {
            await accessRepo.save(
              accessRepo.create({
                userId: hotelUser.id,
                hotelId: hotel.id,
                roleId: role.id,
              }),
            );
            console.log(
              `    Granted Access: ${u.firstName} is ${u.roleName} for ${hotel.name}`,
            );
          }
        }
      }
    }

    console.log('\n=== Custom Database Seeding Complete! ===\n');
  } catch (error) {
    console.error('Custom Seeding failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during Custom Seeding:', err);
  process.exit(1);
});
