import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/database/entities/user.entity';
import { Hotel } from '../src/database/entities/hotel.entity';
import { HotelUserAccess } from '../src/database/entities/hotel-user-access.entity';
import { Role } from '../src/database/entities/role.entity';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const dataSource = app.get(DataSource);

  const users = await dataSource.getRepository(User).find();
  const hotels = await dataSource.getRepository(Hotel).find();
  const accesses = await dataSource.getRepository(HotelUserAccess).find();
  const roles = await dataSource.getRepository(Role).find();

  const roleMap = new Map(roles.map((r) => [r.id, r.name]));
  const hotelMap = new Map(hotels.map((h) => [h.id, h.name]));
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  const accessedUserIds = new Set(accesses.map((a) => a.userId));
  const platformAdmins = users.filter((u) => !accessedUserIds.has(u.id));

  const result = {
    platformAdmins: platformAdmins.map((u) => u.email),
    hotelUsers: accesses.map((a) => ({
      role: roleMap.get(a.roleId),
      email: userMap.get(a.userId),
      hotelId: a.hotelId,
      hotelName: hotelMap.get(a.hotelId),
    })),
  };

  fs.writeFileSync(
    path.join(__dirname, 'query-results.json'),
    JSON.stringify(result, null, 2),
  );

  console.log(
    'Successfully wrote query results to scripts/query-results.json!',
  );
  await app.close();
}
bootstrap().catch((err) => {
  console.error(err);
});
