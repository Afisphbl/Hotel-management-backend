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

  const r = await client.query(`
    SELECT hua."userId", hua."hotelId", hua.status, hua."roleId"
    FROM global.hotel_user_access hua
    WHERE hua."userId" = 'f5b5ed4e-19d3-4683-bbfe-5000a1b299d5'
  `);
  console.log('mezid hotel access:', JSON.stringify(r.rows, null, 2));

  // Show role names for roleIds found
  for (const row of r.rows) {
    const role = await client.query(`SELECT name FROM global.roles WHERE id::text = $1`, [row.roleId]);
    console.log(`  hotelId: ${row.hotelId} => role: ${role.rows[0]?.name}`);
  }

  // Also show all users with access to AbduRes hotel (aad21ced...)
  const abdu = await client.query(`
    SELECT hua."userId", u.email, hua.status, hua."roleId"
    FROM global.hotel_user_access hua
    JOIN global.users u ON u.id::text = hua."userId"
    WHERE hua."hotelId" = 'aad21ced-f39c-4a19-bdb8-fad28851da95'
  `);
  console.log('AbduRes hotel access:', JSON.stringify(abdu.rows, null, 2));

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
