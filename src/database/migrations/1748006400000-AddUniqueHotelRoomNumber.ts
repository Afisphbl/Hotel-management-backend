import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueHotelRoomNumber1748006400000 implements MigrationInterface {
  name = 'AddUniqueHotelRoomNumber1748006400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove duplicate rows first (keep the oldest record per hotel+roomNumber)
    await queryRunner.query(`
      DELETE FROM global.rooms
      WHERE id NOT IN (
        SELECT DISTINCT ON ("hotelId", "roomNumber") id
        FROM global.rooms
        ORDER BY "hotelId", "roomNumber", "createdAt" ASC
      )
    `);

    // Add unique constraint if it doesn't already exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'uq_rooms_hotel_number'
        ) THEN
          ALTER TABLE global.rooms
            ADD CONSTRAINT uq_rooms_hotel_number UNIQUE ("hotelId", "roomNumber");
        END IF;
      END$$;
    `);

    // Sync the rooms count in hotels table to match actual room rows
    await queryRunner.query(`
      UPDATE global.hotels h
      SET rooms = (
        SELECT COUNT(*) FROM global.rooms r WHERE r."hotelId" = h.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE global.rooms DROP CONSTRAINT IF EXISTS uq_rooms_hotel_number
    `);
  }
}
