import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('=== Database Verification Script ===\n');

  process.env.OTEL_ENABLED = 'false';

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    // 1. Check Schemas
    console.log('--- Checking schemas in DB ---');
    const schemas: { schema_name: string }[] = await dataSource.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'hotel_%' OR schema_name = 'global';
    `);
    console.log(
      'Found Schemas:',
      schemas.map((s) => s.schema_name),
    );

    // 2. Query global.hotels
    console.log('\n--- Checking General Hotels (global.hotels) ---');
    try {
      const hotels = await dataSource.query('SELECT * FROM global.hotels;');
      console.log(`Found ${hotels.length} hotels in global.hotels:`);
      console.table(
        hotels.map(
          (h: {
            id: string;
            name: string;
            schemaName: string;
            status: string;
          }) => ({
            id: h.id,
            name: h.name,
            schemaName: h.schemaName,
            status: h.status,
          }),
        ),
      );
    } catch (e) {
      console.error('Failed to query global.hotels:', (e as Error).message);
    }

    // 3. Query global.users
    console.log('\n--- Checking Users (global.users) ---');
    try {
      const users = await dataSource.query(
        'SELECT id, email, "firstName", "lastName", scope, "isActive" FROM global.users;',
      );
      console.log(`Found ${users.length} users in global.users:`);
      console.table(users);
    } catch (e) {
      console.error('Failed to query global.users:', (e as Error).message);
    }

    // 4. Query global.hotel_user_access
    console.log(
      '\n--- Checking User Access Control (global.hotel_user_access) ---',
    );
    try {
      const access = await dataSource.query(
        'SELECT * FROM global.hotel_user_access;',
      );
      console.log(
        `Found ${access.length} connections in global.hotel_user_access:`,
      );
      console.table(access);
    } catch (e) {
      console.error(
        'Failed to query global.hotel_user_access:',
        (e as Error).message,
      );
    }

    // 5. Query tenant schemas
    for (const s of schemas) {
      if (s.schema_name === 'global') continue;
      console.log(`\n--- Checking Tenant Schema (${s.schema_name}) ---`);
      try {
        const rooms = await dataSource.query(
          `SELECT COUNT(*) as count FROM "${s.schema_name}".rooms;`,
        );
        const roomTypes = await dataSource.query(
          `SELECT COUNT(*) as count FROM "${s.schema_name}"."room-types";`,
        );

        // Wait, what's the actual name of room types table? Let's check in the entities or database
        console.log(`Schema "${s.schema_name}" statistics:`);
        console.log(`  - Rooms count:`, rooms[0]?.count || 0);
      } catch (e) {
        console.log(
          `Could not query details for tenant schema ${s.schema_name}:`,
          (e as Error).message,
        );
      }
    }
  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
