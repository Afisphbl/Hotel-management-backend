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
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'global' AND table_name = 'hotels'
      ORDER BY ordinal_position
    `);
    console.log('Hotels columns:');
    cols.rows.forEach((c: any) => console.log(`  ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`));

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'global' AND table_name = 'subscription_payments'
    `);
    console.log('\nSubscription payments table exists:', tables.rows.length > 0);
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  await client.end();
}
main();
