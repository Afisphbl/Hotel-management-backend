import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomTypeIdToBookingRooms1748563200000
  implements MigrationInterface
{
  name = 'AddRoomTypeIdToBookingRooms1748563200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hotels: { schemaName: string }[] = await queryRunner.query(
      `SELECT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`,
    );

    const schemas = [...new Set([...hotels.map((h) => h.schemaName), 'public'])];

    for (const schema of schemas) {
      const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '');
      try {
        await queryRunner.query(
          `ALTER TABLE "${safeSchema}"."booking_rooms" ADD COLUMN "roomTypeId" uuid`,
        );
        console.log(`Added roomTypeId to ${safeSchema}.booking_rooms`);
      } catch (err: any) {
        if (err?.message?.includes('already exists')) {
          console.log(`Column roomTypeId already exists in ${safeSchema}.booking_rooms, skipping`);
        } else {
          throw err;
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hotels: { schemaName: string }[] = await queryRunner.query(
      `SELECT "schemaName" FROM global.hotels WHERE "schemaName" IS NOT NULL`,
    );

    const schemas = [...new Set([...hotels.map((h) => h.schemaName), 'public'])];

    for (const schema of schemas) {
      const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '');
      try {
        await queryRunner.query(
          `ALTER TABLE "${safeSchema}"."booking_rooms" DROP COLUMN "roomTypeId"`,
        );
      } catch {
        // column may not exist
      }
    }
  }
}
