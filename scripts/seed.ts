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

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('🌱 Starting database seeding...');

  try {
    // 1. Create Permissions
    const permissionRepo = dataSource.getRepository(Permission);
    const perms = [
      { slug: 'hotels:manage', description: 'Platform level hotel management' },
      { slug: 'reports:view', description: 'View financial reports' },
      { slug: 'rooms:manage', description: 'Manage hotel rooms' },
      { slug: 'bookings:manage', description: 'Manage guest bookings' },
    ];

    const savedPerms: Permission[] = [];
    for (const p of perms) {
      let perm = await permissionRepo.findOne({ where: { slug: p.slug } });
      if (!perm) {
        perm = await permissionRepo.save(permissionRepo.create(p));
        console.log(`✅ Created permission: ${p.slug}`);
      }
      savedPerms.push(perm);
    }

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
      console.log(`✅ Created Super Admin: ${adminEmail}`);
    }

    // 3. Create Sample Hotel
    const hotelRepo = dataSource.getRepository(Hotel);
    let hotel = await hotelRepo.findOne({ where: { name: 'The Grand Budapest Hotel' } });
    if (!hotel) {
      // Temporary ID for schema name consistency
      const tempId = '00000000-0000-0000-0000-000000000001';
      hotel = await hotelRepo.save(hotelRepo.create({
        id: tempId,
        name: 'The Grand Budapest Hotel',
        schemaName: `hotel_${tempId.replace(/-/g, '_')}`,
        status: HotelStatus.ACTIVE,
      }));
      console.log(`✅ Created Hotel: ${hotel.name} (${hotel.id})`);
    }

    if (!hotel) throw new Error('Failed to create hotel');

    // 4. Create Tenant Schema
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${hotel.schemaName}`);
    console.log(`✅ Created Schema: ${hotel.schemaName}`);

    // 5. Create Hotel Owner Role
    const roleRepo = dataSource.getRepository(Role);
    let ownerRole = await roleRepo.findOne({ where: { name: 'HOTEL_OWNER' } });
    if (!ownerRole) {
      ownerRole = await roleRepo.save(roleRepo.create({
        name: 'HOTEL_OWNER',
        description: 'Full access to hotel operations',
      }));
      console.log('✅ Created Role: HOTEL_OWNER');

      // Link all permissions to Owner
      const rolePermRepo = dataSource.getRepository(RolePermission);
      for (const perm of savedPerms) {
        await rolePermRepo.save(rolePermRepo.create({
          roleId: ownerRole.id,
          permissionId: perm.id,
        }));
      }
    }

    if (!ownerRole) throw new Error('Failed to create role');

    // 6. Create Hotel Owner User
    const ownerEmail = 'owner@grandbudapest.com';
    let owner = await userRepo.findOne({ where: { email: ownerEmail } });
    if (!owner) {
      const hashedPassword = await bcrypt.hash('Owner123!', 10);
      owner = await userRepo.save(userRepo.create({
        email: ownerEmail,
        password: hashedPassword,
        firstName: 'Gustave',
        lastName: 'H',
        scope: UserScope.HOTEL,
        isActive: true,
      }));
      console.log(`✅ Created Hotel Owner: ${ownerEmail}`);
    }

    if (!owner) throw new Error('Failed to create owner');

    // 7. Grant Access to Hotel
    const accessRepo = dataSource.getRepository(HotelUserAccess);
    let access = await accessRepo.findOne({ where: { userId: owner.id, hotelId: hotel.id } });
    if (!access) {
      await accessRepo.save(accessRepo.create({
        userId: owner.id,
        hotelId: hotel.id,
        roleId: ownerRole.id,
      }));
      console.log(`✅ Granted Owner access to ${hotel.name}`);
    }

    console.log('\n🚀 Seeding completed successfully!');
    console.log('\n--- Test Credentials ---');
    console.log(`Super Admin: ${adminEmail} / Admin123!`);
    console.log(`Hotel Owner: ${ownerEmail} / Owner123!`);
    console.log(`Hotel ID: ${hotel.id}`);
    console.log('------------------------\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
