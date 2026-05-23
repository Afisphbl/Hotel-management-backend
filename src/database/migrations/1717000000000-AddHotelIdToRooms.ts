import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHotelIdToRooms1717000000000 implements MigrationInterface {
    name = 'AddHotelIdToRooms1717000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "global"."rooms" ADD COLUMN "hotelId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "global"."rooms" DROP COLUMN "hotelId"`);
    }
}
