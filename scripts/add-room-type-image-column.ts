/**
 * Run: npx ts-node scripts/add-room-type-image-column.ts
 * Adds missing `image` column to room_types in all hotel schemas.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();

  const { rows } = await client.query<{ schemaName: string }>(
    `SELECT "schemaName" FROM global.hotels`,
  );

  for (const { schemaName } of rows) {
    await client.query(`
      ALTER TABLE "${schemaName}"."room_types"
      ADD COLUMN IF NOT EXISTS image VARCHAR
    `);
    console.log(`✓ ${schemaName}`);
  }

  await client.end();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
