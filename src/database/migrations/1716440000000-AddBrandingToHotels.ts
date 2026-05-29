import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrandingToHotels1716440000000 implements MigrationInterface {
  name = 'AddBrandingToHotels1716440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "global"."hotels" ADD COLUMN "branding" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "global"."hotels" DROP COLUMN "branding"`,
    );
  }
}
