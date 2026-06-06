import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { HotelsModule } from '../hotels/hotels.module';
import { HotelModule } from '../hotel/hotel.module';
import { PublicBookingModule } from '../public-booking/public-booking.module';

@Module({
  imports: [ConfigModule, HotelsModule, HotelModule, PublicBookingModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
