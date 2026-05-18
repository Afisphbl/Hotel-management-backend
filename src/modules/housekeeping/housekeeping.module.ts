import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousekeepingTask } from '../../database/entities/housekeeping-task.entity';
import { HousekeepingController } from './controllers/housekeeping.controller';
import { HousekeepingService } from './services/housekeeping.service';

@Module({
  imports: [TypeOrmModule.forFeature([HousekeepingTask])],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
