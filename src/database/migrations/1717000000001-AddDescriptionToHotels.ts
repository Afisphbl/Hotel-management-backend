import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionToHotels1717000000001 implements MigrationInterface {
  name = 'AddDescriptionToHotels1717000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "global"."hotels" ADD COLUMN "description" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "global"."hotels" DROP COLUMN "description"`,
    );
  }
}
