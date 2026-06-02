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

  const res = await client.query(`SELECT "schemaName" FROM global.hotels`);
  const schemas = res.rows.map(row => row.schemaName);

  console.log(`Found ${schemas.length} schemas to update.`);

  for (const s of schemas) {
    console.log(`Updating schema: ${s}`);
    try {
      await client.query(`ALTER TABLE "${s}"."staff" ADD COLUMN IF NOT EXISTS "password" VARCHAR`);
      console.log(`  ✓ Added password column in ${s}`);
    } catch (err) {
      console.error(`  ✗ Failed to update ${s}:`, err.message);
    }
  }

  await client.end();
  console.log('\nAll staff tables updated successfully.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
