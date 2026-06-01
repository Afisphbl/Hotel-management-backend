import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomImages1760000000000 implements MigrationInterface {
  name = 'AddRoomImages1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add images column to rooms in each hotel schema
    const hotels: { schemaName: string }[] = await queryRunner.query(
      `SELECT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`,
    );

    for (const hotel of hotels) {
      const s = hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = '${s}' AND table_name = 'rooms' AND column_name = 'images'
          ) THEN
            ALTER TABLE "${s}".rooms ADD COLUMN images text[];
          END IF;
        END$$;
      `);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = '${s}' AND table_name = 'room_types' AND column_name = 'image'
          ) THEN
            ALTER TABLE "${s}".room_types ADD COLUMN image text;
          END IF;
        END$$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hotels: { schemaName: string }[] = await queryRunner.query(
      `SELECT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`,
    );

    for (const hotel of hotels) {
      const s = hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');
      await queryRunner.query(`ALTER TABLE "${s}".rooms DROP COLUMN IF EXISTS images`);
      await queryRunner.query(`ALTER TABLE "${s}".room_types DROP COLUMN IF EXISTS image`);
    }
  }
}
