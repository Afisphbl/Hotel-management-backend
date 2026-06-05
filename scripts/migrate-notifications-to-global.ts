/**
 * Migrates notifications to global schema.
 *
 * What it does:
 *  1. Creates global.notifications table (with correct enum including bill_submitted)
 *  2. Copies all existing notification rows from every tenant schema
 *  3. Does NOT delete tenant schema tables (safe, read-only for existing data)
 *
 * Run: npx ts-node scripts/migrate-notifications-to-global.ts
 */
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
  console.log('Connected.\n');

  // 1. Create the enum type in global schema (if not exists)
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notifications_type_enum' AND n.nspname = 'global'
      ) THEN
        CREATE TYPE global.notifications_type_enum AS ENUM (
          'booking_confirmed', 'booking_cancelled', 'booking_checked_in', 'booking_checked_out',
          'payment_received', 'refund_processed', 'invoice_ready', 'invoice_overdue',
          'housekeeping_task', 'maintenance_ticket', 'shift_reminder', 'new_review',
          'payment_reminder', 'payment_overdue', 'account_suspended', 'account_reactivated',
          'bill_submitted'
        );
      ELSE
        -- Ensure bill_submitted exists in case the enum was already created without it
        ALTER TYPE global.notifications_type_enum ADD VALUE IF NOT EXISTS 'bill_submitted';
      END IF;
    END $$;
  `);
  console.log('✓ global.notifications_type_enum ready');

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notifications_channel_enum' AND n.nspname = 'global'
      ) THEN
        CREATE TYPE global.notifications_channel_enum AS ENUM ('in_app', 'email', 'both');
      END IF;
    END $$;
  `);

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'notifications_status_enum' AND n.nspname = 'global'
      ) THEN
        CREATE TYPE global.notifications_status_enum AS ENUM ('pending', 'sent', 'failed');
      END IF;
    END $$;
  `);
  console.log('✓ global.notifications_channel_enum and notifications_status_enum ready');

  // 2. Create global.notifications table
  await client.query(`
    CREATE TABLE IF NOT EXISTS global.notifications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ,
      "userId"    VARCHAR NOT NULL,
      type        global.notifications_type_enum NOT NULL,
      title       VARCHAR NOT NULL,
      body        TEXT NOT NULL,
      data        JSONB,
      channel     global.notifications_channel_enum NOT NULL DEFAULT 'in_app',
      status      global.notifications_status_enum NOT NULL DEFAULT 'pending',
      "readAt"    TIMESTAMPTZ,
      "sentAt"    TIMESTAMPTZ,
      error       TEXT
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_userId_status" ON global.notifications ("userId", status);`);
  await client.query(`CREATE INDEX IF NOT EXISTS "IDX_notifications_type" ON global.notifications (type);`);
  console.log('✓ global.notifications table ready\n');

  // 3. Find all tenant schemas (hotel_*)
  const schemasRes = await client.query<{ schema_name: string }>(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'hotel_%'
    ORDER BY schema_name;
  `);
  const tenantSchemas = schemasRes.rows.map(r => r.schema_name);
  console.log(`Found ${tenantSchemas.length} tenant schema(s): ${tenantSchemas.join(', ') || 'none'}\n`);

  // 4. Copy data from each tenant schema, skip duplicates by id
  let totalCopied = 0;
  for (const schema of tenantSchemas) {
    // Check if notifications table exists in this schema
    const tableCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'notifications'
      ) AS exists;
    `, [schema]);

    if (!tableCheck.rows[0].exists) {
      console.log(`  ${schema}: no notifications table, skipping`);
      continue;
    }

    // Copy rows, casting enum columns as text then to global enum
    // ON CONFLICT skips rows already copied (idempotent reruns)
    const result = await client.query(`
      INSERT INTO global.notifications
        (id, "createdAt", "updatedAt", "deletedAt", "userId", type, title, body, data, channel, status, "readAt", "sentAt", error)
      SELECT
        id, "createdAt", "updatedAt", "deletedAt", "userId",
        type::text::global.notifications_type_enum,
        title, body, data,
        channel::text::global.notifications_channel_enum,
        status::text::global.notifications_status_enum,
        "readAt", "sentAt", error
      FROM "${schema}".notifications
      ON CONFLICT (id) DO NOTHING;
    `);

    const copied = result.rowCount ?? 0;
    totalCopied += copied;
    console.log(`  ✓ ${schema}: copied ${copied} row(s)`);
  }

  console.log(`\nTotal rows copied: ${totalCopied}`);
  console.log('\nTenant schema notifications tables are left intact (not deleted).');
  console.log('Migration complete.');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
