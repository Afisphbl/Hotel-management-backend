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
    await client.query('BEGIN');

    // Add monthlyRate column
    await client.query(`
      ALTER TABLE "global"."hotels"
        ADD COLUMN IF NOT EXISTS "monthlyRate" numeric(12,2) DEFAULT NULL
    `);
    console.log('✓ Added monthlyRate column');

    // Add lastPaidAt column
    await client.query(`
      ALTER TABLE "global"."hotels"
        ADD COLUMN IF NOT EXISTS "lastPaidAt" timestamptz DEFAULT NULL
    `);
    console.log('✓ Added lastPaidAt column');

    // Add billingPeriodStart column
    await client.query(`
      ALTER TABLE "global"."hotels"
        ADD COLUMN IF NOT EXISTS "billingPeriodStart" timestamptz DEFAULT NULL
    `);
    console.log('✓ Added billingPeriodStart column');

    // Create subscription_payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "global"."subscription_payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "hotelId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'ETB',
        "method" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "periodStart" timestamptz NOT NULL,
        "periodEnd" timestamptz NOT NULL,
        "paidAt" timestamptz DEFAULT NULL,
        "transactionId" character varying DEFAULT NULL,
        "gatewayResponse" jsonb DEFAULT NULL,
        "receiptUrl" text DEFAULT NULL,
        "confirmedByAdminId" character varying DEFAULT NULL,
        "notes" text DEFAULT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz DEFAULT NULL,
        CONSTRAINT "PK_subscription_payments" PRIMARY KEY ("id")
      )
    `);
    console.log('✓ Created subscription_payments table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sub_pay_hotel_period"
        ON "global"."subscription_payments" ("hotelId", "periodStart")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sub_pay_hotel_status"
        ON "global"."subscription_payments" ("hotelId", "status")
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sub_pay_transaction"
        ON "global"."subscription_payments" ("transactionId")
        WHERE "transactionId" IS NOT NULL
    `);
    console.log('✓ Created indexes');

    // Add foreign key
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_sub_pay_hotel'
        ) THEN
          ALTER TABLE "global"."subscription_payments"
            ADD CONSTRAINT "FK_sub_pay_hotel"
            FOREIGN KEY ("hotelId")
            REFERENCES "global"."hotels"("id")
            ON DELETE CASCADE;
        END IF;
      END$$;
    `);
    console.log('✓ Added foreign key constraint');

    // Record migration
    const maxId = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM global."migrations"');
    const nextId = maxId.rows[0].next_id;
    await client.query(`
      INSERT INTO global."migrations" ("id", "timestamp", "name")
      VALUES ($1, 1790000000000, 'AddMonthlyBillingFields1790000000000')
      ON CONFLICT DO NOTHING
    `, [nextId]);
    console.log(`✓ Recorded migration (id=${nextId}) in migrations table`);

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(() => process.exit(1));
