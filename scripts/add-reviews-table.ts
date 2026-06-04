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

  // Get all unique hotel schemas
  const res = await client.query(`SELECT DISTINCT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`);
  const schemas = res.rows.map(r => r.schemaName);

  console.log(`Found ${schemas.length} schemas to update.`);

  for (const s of schemas) {
    console.log(`Updating schema: ${s}`);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${s}"."reviews" (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "rating" INT NOT NULL,
          "comment" TEXT NOT NULL,
          "roomId" UUID NOT NULL REFERENCES "${s}"."rooms"(id),
          "guestId" UUID NOT NULL REFERENCES "${s}"."guests"(id),
          "hotelId" VARCHAR NOT NULL,
          "isVisible" BOOLEAN DEFAULT TRUE,
          status VARCHAR NOT NULL DEFAULT 'pending',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "deletedAt" TIMESTAMPTZ
        )
      `);
      console.log(`  ✓ reviews table created in ${s}`);

      // Add status column to existing tables that may not have it
      try {
        await client.query(`
          ALTER TABLE "${s}"."reviews"
          ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'pending'
        `);
      } catch {}
    } catch (err) {
      console.error(`  ✗ Failed to update schema ${s}:`, err.message);
    }
  }

  await client.end();
  console.log('\nAll schemas processed.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
