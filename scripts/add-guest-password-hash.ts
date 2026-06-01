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

  const res = await client.query(`SELECT "schemaName", name FROM global.hotels`);
  const schemas = res.rows;

  console.log(`Found ${schemas.length} hotel schemas to update.`);

  for (const { schemaName, name } of schemas) {
    console.log(`\n[${name}] schema: ${schemaName}`);
    try {
      await client.query(
        `ALTER TABLE "${schemaName}"."guests" ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR`,
      );
      console.log(`  ✓ Added passwordHash column`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  await client.end();
  console.log('\nDone.');
}

main().catch(console.error);
