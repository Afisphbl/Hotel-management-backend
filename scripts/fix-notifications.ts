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

  // Add missing enum values to global.notifications_type_enum
  // ALTER TYPE ... ADD VALUE cannot use parameters, must be literal
  const missing = ['new_review', 'payment_reminder', 'payment_overdue', 'account_suspended', 'account_reactivated', 'bill_submitted'];
  for (const v of missing) {
    await client.query(`ALTER TYPE global.notifications_type_enum ADD VALUE IF NOT EXISTS '${v}'`);
    console.log(`✓ Added enum value: ${v}`);
  }

  console.log('\nAll enum values now in global.notifications_type_enum:');
  const enums = await client.query(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'notifications_type_enum' AND n.nspname = 'global' ORDER BY e.enumsortorder`);
  console.log(enums.rows.map((r: any) => r.enumlabel));

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
