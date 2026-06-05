import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingSourceAndNotes1760000000001 implements MigrationInterface {
  name = 'AddBookingSourceAndNotes1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hotels: { schemaName: string }[] = await queryRunner.query(
      `SELECT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`,
    );

    for (const hotel of hotels) {
      const s = hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');
      await queryRunner.query(
        `ALTER TABLE "${s}".bookings ADD COLUMN IF NOT EXISTS source VARCHAR(50)`,
      );
      await queryRunner.query(
        `ALTER TABLE "${s}".bookings ADD COLUMN IF NOT EXISTS notes TEXT`,
      );
      await queryRunner.query(
        `ALTER TABLE "${s}".bookings ADD COLUMN IF NOT EXISTS "numGuests" INT`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hotels: { schemaName: string }[] = await queryRunner.query(
      `SELECT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`,
    );

    for (const hotel of hotels) {
      const s = hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');
      await queryRunner.query(
        `ALTER TABLE "${s}".bookings DROP COLUMN IF EXISTS source`,
      );
      await queryRunner.query(
        `ALTER TABLE "${s}".bookings DROP COLUMN IF EXISTS notes`,
      );
      await queryRunner.query(
        `ALTER TABLE "${s}".bookings DROP COLUMN IF EXISTS "numGuests"`,
      );
    }
  }
}
