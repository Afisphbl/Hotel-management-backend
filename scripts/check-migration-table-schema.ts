import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'global' AND table_name = 'migrations'
      ORDER BY ordinal_position
    `);
    console.log('Migrations table columns:');
    res.rows.forEach((c: any) => console.log(`  ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  await client.end();
}
main();
