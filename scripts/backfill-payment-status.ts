/**
 * Backfill: sync existing PAID/VOID/OVERDUE invoices with their PENDING payments.
 * Run: npx ts-node scripts/backfill-payment-status.ts [hotelId]
 * Example: npx ts-node scripts/backfill-payment-status.ts
 *          npx ts-node scripts/backfill-payment-status.ts 4193f8a1-f829-444a-84bf-1afa104398c3
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const targetHotelId = process.argv[2];

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  let schemas: string[];
  if (targetHotelId) {
    const res = await client.query(`SELECT "schemaName" FROM global.hotels WHERE id = $1`, [targetHotelId]);
    if (!res.rows.length) { console.error('Hotel not found'); process.exit(1); }
    schemas = [res.rows[0].schemaName];
  } else {
    const res = await client.query(`SELECT "schemaName" FROM global.hotels`);
    schemas = res.rows.map(r => r.schemaName);
  }

  let totalUpdated = 0;

  for (const schema of schemas) {
    // PAID invoices → mark PENDING payments as COMPLETED
    const paidResult = await client.query(`
      UPDATE "${schema}"."payments" p
      SET status = 'completed', "paidAt" = COALESCE(p."paidAt", NOW())
      FROM "${schema}"."invoices" i
      WHERE p."invoiceId" = i.id
        AND p.status = 'pending'
        AND i.status = 'paid'
    `);
    const paidCount = paidResult.rowCount ?? 0;
    if (paidCount > 0) {
      console.log(`[${schema}] Marked ${paidCount} payment(s) as completed (invoice PAID)`);
      totalUpdated += paidCount;
    }

    // VOID invoices → mark PENDING payments as refunded
    const voidResult = await client.query(`
      UPDATE "${schema}"."payments" p
      SET status = 'refunded'
      FROM "${schema}"."invoices" i
      WHERE p."invoiceId" = i.id
        AND p.status = 'pending'
        AND i.status = 'void'
    `);
    const voidCount = voidResult.rowCount ?? 0;
    if (voidCount > 0) {
      console.log(`[${schema}] Marked ${voidCount} payment(s) as refunded (invoice VOID)`);
      totalUpdated += voidCount;
    }

    // OVERDUE invoices — leave payments as PENDING; they weren't paid
    // DRAFT/ISSUED invoices — leave payments as PENDING; correct state
  }

  console.log(`\nDone. ${totalUpdated} total payment(s) updated.`);
  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
