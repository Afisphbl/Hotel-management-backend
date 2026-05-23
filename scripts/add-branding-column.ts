import { Client } from 'pg';
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'As$030895',
  database: 'multi_tenant_hotel_management_system_db',
});
async function main() {
  await client.connect();
  await client.query('ALTER TABLE "global"."hotels" ADD COLUMN IF NOT EXISTS "branding" jsonb');
  console.log('Column "branding" added successfully');
  await client.end();
}
main();
