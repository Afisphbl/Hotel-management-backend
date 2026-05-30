/**
 * Run: npx ts-node scripts/reprovision-schema.ts <hotelId>
 * Example: npx ts-node scripts/reprovision-schema.ts 4193f8a1-f829-444a-84bf-1afa104398c3
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const hotelId = process.argv[2];
  if (!hotelId) { console.error('Usage: npx ts-node scripts/reprovision-schema.ts <hotelId>'); process.exit(1); }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();

  const res = await client.query(`SELECT "schemaName" FROM global.hotels WHERE id = $1`, [hotelId]);
  if (!res.rows.length) { console.error('Hotel not found'); process.exit(1); }
  const s = res.rows[0].schemaName;
  console.log(`Provisioning schema: ${s}`);

  await client.query(`CREATE SCHEMA IF NOT EXISTS "${s}"`);

  const tables = [
    `CREATE TABLE IF NOT EXISTS "${s}"."room_types" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL, description TEXT,
      "baseCapacity" INT NOT NULL, "maxExtraBeds" INT NOT NULL DEFAULT 0, "basePrice" NUMERIC(12,2) NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."rooms" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "roomNumber" VARCHAR NOT NULL, floor VARCHAR NOT NULL,
      "hotelId" VARCHAR NOT NULL, "roomTypeId" UUID REFERENCES "${s}"."room_types"(id),
      "basePrice" NUMERIC(12,2), "baseCapacity" INT, status VARCHAR NOT NULL DEFAULT 'available',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ,
      UNIQUE("hotelId", "roomNumber"))`,
    `CREATE TABLE IF NOT EXISTS "${s}"."guests" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "firstName" VARCHAR NOT NULL, "lastName" VARCHAR NOT NULL,
      email VARCHAR NOT NULL UNIQUE, phone VARCHAR, "nationality" VARCHAR, "isVip" BOOLEAN DEFAULT FALSE,
      "documentType" VARCHAR, "documentNumber" VARCHAR, metadata JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."bookings" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "guestId" UUID NOT NULL REFERENCES "${s}"."guests"(id),
      "checkIn" TIMESTAMPTZ NOT NULL, "checkOut" TIMESTAMPTZ NOT NULL, status VARCHAR NOT NULL DEFAULT 'pending',
      "totalPrice" NUMERIC(12,2) NOT NULL, "idempotencyKey" VARCHAR NOT NULL UNIQUE, "priceSnapshot" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."booking_rooms" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "bookingId" UUID NOT NULL REFERENCES "${s}"."bookings"(id),
      "roomId" UUID NOT NULL REFERENCES "${s}"."rooms"(id), price NUMERIC(12,2) NOT NULL, "nightPrices" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."room_nights" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "roomId" UUID NOT NULL REFERENCES "${s}"."rooms"(id),
      date DATE NOT NULL, status VARCHAR NOT NULL, "bookingId" UUID REFERENCES "${s}"."bookings"(id),
      price NUMERIC(12,2) NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ, UNIQUE("roomId", date))`,
    `CREATE TABLE IF NOT EXISTS "${s}"."staff" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "userId" VARCHAR NOT NULL, "firstName" VARCHAR NOT NULL,
      "lastName" VARCHAR NOT NULL, email VARCHAR NOT NULL UNIQUE, phone VARCHAR, role VARCHAR NOT NULL,
      "employmentType" VARCHAR NOT NULL DEFAULT 'full_time', status VARCHAR NOT NULL DEFAULT 'active',
      "hourlyRate" NUMERIC(12,2), department VARCHAR, "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."shifts" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "staffId" UUID NOT NULL, "startTime" TIMESTAMPTZ NOT NULL,
      "endTime" TIMESTAMPTZ NOT NULL, status VARCHAR NOT NULL DEFAULT 'scheduled', "checkInTime" TIMESTAMPTZ,
      "checkOutTime" TIMESTAMPTZ, notes TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."housekeeping_tasks" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "roomId" UUID NOT NULL, "assignedTo" UUID,
      status VARCHAR NOT NULL DEFAULT 'pending', priority VARCHAR NOT NULL DEFAULT 'medium',
      description TEXT NOT NULL, "scheduledDate" DATE, "completedAt" TIMESTAMPTZ, notes TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."maintenance_tickets" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "roomId" UUID NOT NULL, "reportedBy" VARCHAR NOT NULL,
      "assignedTo" UUID, title VARCHAR NOT NULL, description TEXT NOT NULL, status VARCHAR NOT NULL DEFAULT 'reported',
      priority VARCHAR NOT NULL DEFAULT 'medium', category VARCHAR, "resolvedAt" TIMESTAMPTZ, cost NUMERIC(12,2), notes TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."tax_rules" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL, type VARCHAR NOT NULL,
      rate NUMERIC(5,2) NOT NULL, application VARCHAR NOT NULL DEFAULT 'percentage', "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "validFrom" DATE, "validTo" DATE, description TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."rate_plans" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL, description TEXT,
      "roomTypeId" UUID NOT NULL REFERENCES "${s}"."room_types"(id), "weekdayAdjustment" NUMERIC(5,2) NOT NULL DEFAULT 0,
      "weekendAdjustment" NUMERIC(5,2) NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."seasonal_rates" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL,
      "roomTypeId" UUID NOT NULL REFERENCES "${s}"."room_types"(id), "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
      "fixedPrice" NUMERIC(12,2), multiplier NUMERIC(5,2), priority INT NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."price_overrides" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "roomTypeId" UUID NOT NULL REFERENCES "${s}"."room_types"(id),
      date DATE NOT NULL, price NUMERIC(12,2) NOT NULL, reason TEXT, "createdBy" VARCHAR,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."promotions" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR NOT NULL, description TEXT, code VARCHAR,
      "roomTypeId" UUID REFERENCES "${s}"."room_types"(id), "discountType" VARCHAR NOT NULL,
      "discountValue" NUMERIC(12,2) NOT NULL, "startDate" DATE NOT NULL, "endDate" DATE NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."invoices" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "invoiceNumber" VARCHAR,
      "bookingId" UUID NOT NULL REFERENCES "${s}"."bookings"(id), amount NUMERIC(12,2) NOT NULL,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0, "taxTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR NOT NULL DEFAULT 'ETB', status VARCHAR NOT NULL DEFAULT 'draft', "lineItems" JSONB,
      "dueDate" TIMESTAMPTZ, "paidAt" TIMESTAMPTZ, notes TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."payments" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "invoiceId" UUID NOT NULL REFERENCES "${s}"."invoices"(id),
      "bookingId" UUID REFERENCES "${s}"."bookings"(id), amount NUMERIC(12,2) NOT NULL,
      fee NUMERIC(12,2) NOT NULL DEFAULT 0, "netAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      currency VARCHAR NOT NULL DEFAULT 'ETB', method VARCHAR NOT NULL, status VARCHAR NOT NULL DEFAULT 'pending',
      "transactionId" VARCHAR, "gatewayResponse" JSONB, "idempotencyKey" VARCHAR, description TEXT, "paidAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."refunds" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "paymentId" UUID NOT NULL REFERENCES "${s}"."payments"(id),
      "invoiceId" UUID REFERENCES "${s}"."invoices"(id), "bookingId" UUID REFERENCES "${s}"."bookings"(id),
      amount NUMERIC(12,2) NOT NULL, currency VARCHAR NOT NULL DEFAULT 'ETB', reason VARCHAR NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'completed', "transactionId" VARCHAR, "idempotencyKey" VARCHAR,
      "processedAt" TIMESTAMPTZ, notes TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}"."ledger_entries" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "accountId" VARCHAR NOT NULL, debit NUMERIC(12,2) NOT NULL,
      credit NUMERIC(12,2) NOT NULL, currency VARCHAR NOT NULL DEFAULT 'ETB', "referenceType" VARCHAR NOT NULL,
      "referenceId" VARCHAR NOT NULL, "bookingId" UUID, "entryDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      description TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ)`,
  ];

  for (const sql of tables) {
    await client.query(sql);
    const tableName = sql.match(/"([^"]+)"."([^"]+)"/)?.[2] ?? '?';
    console.log(`  ✓ ${tableName}`);
  }

  await client.end();
  console.log(`\nDone. Schema "${s}" is fully provisioned.`);
}

main().catch(e => { console.error(e); process.exit(1); });
