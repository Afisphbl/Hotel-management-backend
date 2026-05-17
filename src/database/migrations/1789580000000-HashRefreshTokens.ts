import { MigrationInterface, QueryRunner } from 'typeorm';

export class HashRefreshTokens1789580000000 implements MigrationInterface {
  name = 'HashRefreshTokens1789580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "global"."refresh_tokens" ADD "hotelId" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "global"."refresh_tokens" ADD "tokenHashAlgorithm" character varying NOT NULL DEFAULT \'hmac-sha256\'',
    );
    await queryRunner.query(
      'UPDATE "global"."refresh_tokens" SET "status" = \'revoked\', "revokedAt" = COALESCE("revokedAt", NOW()) WHERE "status" = \'active\'',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "global"."refresh_tokens" DROP COLUMN "tokenHashAlgorithm"',
    );
    await queryRunner.query(
      'ALTER TABLE "global"."refresh_tokens" DROP COLUMN "hotelId"',
    );
  }
}
