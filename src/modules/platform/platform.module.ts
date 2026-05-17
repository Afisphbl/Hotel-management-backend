import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformHotelsController } from './platform-hotels.controller';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformService } from './platform.service';
import { Hotel } from '../../database/entities/hotel.entity';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hotel, User, Booking]),
  ],
  controllers: [PlatformHotelsController, PlatformAnalyticsController],
  providers: [PlatformService],
})
export class PlatformModule {}
