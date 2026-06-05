import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonthlyBillingFields1790000000000
  implements MigrationInterface
{
  name = 'AddMonthlyBillingFields1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "global"."hotels"
        ADD COLUMN "monthlyRate" numeric(12,2) DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "global"."hotels"
        ADD COLUMN "lastPaidAt" timestamptz DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "global"."hotels"
        ADD COLUMN "billingPeriodStart" timestamptz DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "global"."subscription_payments" (
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

    await queryRunner.query(`
      CREATE INDEX "IDX_sub_pay_hotel_period"
        ON "global"."subscription_payments" ("hotelId", "periodStart")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_sub_pay_hotel_status"
        ON "global"."subscription_payments" ("hotelId", "status")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_sub_pay_transaction"
        ON "global"."subscription_payments" ("transactionId")
        WHERE "transactionId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "global"."subscription_payments"
        ADD CONSTRAINT "FK_sub_pay_hotel"
        FOREIGN KEY ("hotelId")
        REFERENCES "global"."hotels"("id")
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "global"."subscription_payments"
    `);

    await queryRunner.query(`
      ALTER TABLE "global"."hotels" DROP COLUMN IF EXISTS "billingPeriodStart"
    `);

    await queryRunner.query(`
      ALTER TABLE "global"."hotels" DROP COLUMN IF EXISTS "lastPaidAt"
    `);

    await queryRunner.query(`
      ALTER TABLE "global"."hotels" DROP COLUMN IF EXISTS "monthlyRate"
    `);
  }
}
