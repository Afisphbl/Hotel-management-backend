/* eslint-disable */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserScope } from '../src/database/entities/user.entity';
import { Role } from '../src/database/entities/role.entity';
import { HotelUserAccess } from '../src/database/entities/hotel-user-access.entity';
import { Hotel } from '../src/database/entities/hotel.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);

  const email = 'abuabdurehman0308@gmail.com';
  const password = 'Ha@1234567890';
  const hotelName = 'AbduRes'; // Change if needed

  // Find or create user
  let user = await ds.getRepository(User).findOne({ where: { email } });
  if (user) {
    console.log(`User ${email} already exists — updating password`);
    user.password = await bcrypt.hash(password, 10);
    await ds.getRepository(User).save(user);
  } else {
    console.log(`Creating user ${email}`);
    user = ds.getRepository(User).create({
      email,
      password: await bcrypt.hash(password, 10),
      firstName: 'Abduselam',
      lastName: 'Seid',
      scope: UserScope.HOTEL,
      isActive: true,
    });
    user = await ds.getRepository(User).save(user);
  }

  // Find the hotel
  const hotel = await ds.getRepository(Hotel).findOne({ where: { name: hotelName } });
  if (!hotel) {
    console.log(`Hotel "${hotelName}" not found. Looking up by owner email...`);
    const hotelByEmail = await ds.getRepository(Hotel).findOne({ where: { ownerEmail: email } });
    if (hotelByEmail) {
      console.log(`Found hotel "${hotelByEmail.name}" (${hotelByEmail.id})`);
      await linkUserToHotel(ds, user, hotelByEmail);
    } else {
      console.log('No hotel found for this email either.');
    }
  } else {
    console.log(`Found hotel "${hotel.name}" (${hotel.id})`);
    await linkUserToHotel(ds, user, hotel);
  }

  console.log('Done!');
  await app.close();
}

async function linkUserToHotel(ds: DataSource, user: User, hotel: Hotel) {
  // Check if access already exists
  const existing = await ds.getRepository(HotelUserAccess).findOne({
    where: { userId: user.id, hotelId: hotel.id },
  });
  if (existing) {
    console.log('User already linked to this hotel.');
    return;
  }

  // Find HOTEL_OWNER role
  let ownerRole = await ds.getRepository(Role).findOne({ where: { name: 'HOTEL_OWNER' } });
  if (!ownerRole) {
    console.log('HOTEL_OWNER role not found — skipping link');
    return;
  }

  const access = ds.getRepository(HotelUserAccess).create({
    userId: user.id,
    hotelId: hotel.id,
    roleId: ownerRole.id,
    grantedAt: new Date(),
  });
  await ds.getRepository(HotelUserAccess).save(access);

  // Update hotel ownerEmail if not set
  if (!hotel.ownerEmail) {
    hotel.ownerEmail = user.email;
    await ds.getRepository(Hotel).save(hotel);
  }

  console.log(`Linked user to hotel ${hotel.name} as HOTEL_OWNER`);
}

bootstrap().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
