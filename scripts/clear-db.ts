import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  console.log('=== Hotel Booking System - Clearing Database ===\n');

  // Set env token variables to avoid error or bypass OTEL if needed
  process.env.OTEL_ENABLED = 'false';

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    console.log('1. Fetching all schemata...');
    const schemas: { schema_name: string }[] = await dataSource.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'hotel_%' OR schema_name = 'global';
    `);

    const schemaNames = schemas.map((s) => s.schema_name);
    console.log(`Found schemas: ${schemaNames.join(', ') || 'None'}`);

    for (const schemaName of schemaNames) {
      console.log(`Dropping schema: "${schemaName}"...`);
      await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
      console.log(`Dropped schema: "${schemaName}"`);
    }

    // Double check if there are any stray tables in public schema just in case
    // Though the project uses 'global' for global entities, let's keep public schema intact.

    console.log('\n=== Database cleared successfully! ===\n');
  } catch (error) {
    console.error('Failed to clear database:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during DB clear:', err);
  process.exit(1);
});
