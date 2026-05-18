import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hotel } from '../../database/entities/hotel.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Hotel])],
  exports: [TypeOrmModule],
})
export class HotelsModule {}
