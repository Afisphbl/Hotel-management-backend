"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../src/database/entities/user.entity");
const permission_entity_1 = require("../src/database/entities/permission.entity");
const role_entity_1 = require("../src/database/entities/role.entity");
const role_permission_entity_1 = require("../src/database/entities/role-permission.entity");
const hotel_entity_1 = require("../src/database/entities/hotel.entity");
const hotel_user_access_entity_1 = require("../src/database/entities/hotel-user-access.entity");
const bcrypt = __importStar(require("bcrypt"));
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
    { slug: 'housekeeping:update', description: 'Update housekeeping task status' },
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
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const dataSource = app.get(typeorm_1.DataSource);
    console.log('Seeding database...');
    try {
        const permissionRepo = dataSource.getRepository(permission_entity_1.Permission);
        const savedPermissions = {};
        for (const p of PERMISSIONS) {
            let perm = await permissionRepo.findOne({ where: { slug: p.slug } });
            if (!perm) {
                perm = await permissionRepo.save(permissionRepo.create(p));
            }
            savedPermissions[p.slug] = perm;
        }
        console.log(`Created ${Object.keys(savedPermissions).length} permissions`);
        const userRepo = dataSource.getRepository(user_entity_1.User);
        const adminEmail = 'admin@platform.com';
        let admin = await userRepo.findOne({ where: { email: adminEmail } });
        if (!admin) {
            const hashedPassword = await bcrypt.hash('Admin123!', 10);
            admin = await userRepo.save(userRepo.create({
                email: adminEmail,
                password: hashedPassword,
                firstName: 'System',
                lastName: 'Admin',
                scope: user_entity_1.UserScope.PLATFORM,
                isActive: true,
            }));
            console.log(`Created Super Admin: ${adminEmail}`);
        }
        const hotelRepo = dataSource.getRepository(hotel_entity_1.Hotel);
        let hotel = await hotelRepo.findOne({ where: { name: 'The Grand Budapest Hotel' } });
        if (!hotel) {
            const tempId = '00000000-0000-0000-0000-000000000001';
            hotel = await hotelRepo.save(hotelRepo.create({
                id: tempId,
                name: 'The Grand Budapest Hotel',
                schemaName: `hotel_${tempId.replace(/-/g, '_')}`,
                status: hotel_entity_1.HotelStatus.ACTIVE,
            }));
            console.log(`Created Hotel: ${hotel.name} (${hotel.id})`);
        }
        if (!hotel)
            throw new Error('Failed to create hotel');
        await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${hotel.schemaName}`);
        console.log(`Created Schema: ${hotel.schemaName}`);
        const roleRepo = dataSource.getRepository(role_entity_1.Role);
        const rolePermRepo = dataSource.getRepository(role_permission_entity_1.RolePermission);
        const createdRoles = {};
        for (const roleDef of ROLES) {
            let role = await roleRepo.findOne({ where: { name: roleDef.name } });
            if (!role) {
                role = await roleRepo.save(roleRepo.create({
                    name: roleDef.name,
                    description: roleDef.description,
                    isSystemRole: true,
                }));
                console.log(`Created Role: ${roleDef.name}`);
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
            }
            else {
                console.log(`Role already exists: ${roleDef.name}`);
            }
            const email = `${roleDef.name.toLowerCase()}@grandbudapest.com`;
            let testUser = await userRepo.findOne({ where: { email } });
            if (!testUser) {
                const hashedPassword = await bcrypt.hash('Test123!', 10);
                testUser = await userRepo.save(userRepo.create({
                    email,
                    password: hashedPassword,
                    firstName: roleDef.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
                    lastName: 'User',
                    scope: user_entity_1.UserScope.HOTEL,
                    isActive: true,
                }));
                console.log(`  Created user: ${email}`);
            }
            const accessRepo = dataSource.getRepository(hotel_user_access_entity_1.HotelUserAccess);
            let access = await accessRepo.findOne({ where: { userId: testUser.id, hotelId: hotel.id } });
            if (!access) {
                await accessRepo.save(accessRepo.create({
                    userId: testUser.id,
                    hotelId: hotel.id,
                    roleId: role.id,
                }));
                console.log(`  Granted ${roleDef.name} access to hotel`);
            }
            createdRoles[roleDef.name] = { role: role, user: testUser };
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
    }
    catch (error) {
        console.error('Seeding failed:', error);
        throw error;
    }
    finally {
        await app.close();
    }
}
bootstrap();
//# sourceMappingURL=seed.js.map