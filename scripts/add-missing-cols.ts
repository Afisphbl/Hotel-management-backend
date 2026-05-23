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
  const cols = ['settings', 'subscription', 'paymentMethods', 'cancellationPolicy'];
  for (const col of cols) {
    await client.query(`ALTER TABLE "global"."hotels" ADD COLUMN IF NOT EXISTS "${col}" jsonb`);
    console.log(`Column "${col}" added successfully`);
  }
  await client.end();
}
main();
