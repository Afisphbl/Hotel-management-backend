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
    const res = await client.query('SELECT * FROM global."migrations" ORDER BY id');
    console.log('Count:', res.rows.length);
    if (res.rows.length > 0) {
      console.log('Records:', JSON.stringify(res.rows, null, 2));
    } else {
      console.log('Migrations table exists but is empty');
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
  await client.end();
}
main();
