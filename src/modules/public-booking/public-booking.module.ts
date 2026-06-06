import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicBookingController } from './public-booking.controller';
import { PublicBookingService } from './public-booking.service';
import { ChapaService } from './chapa.service';
import { Booking } from '../../database/entities/booking.entity';
import { BookingRoom } from '../../database/entities/booking-room.entity';
import { RoomNight } from '../../database/entities/room-night.entity';
import { Room } from '../../database/entities/room.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Hotel } from '../../database/entities/hotel.entity';
import { HotelModule } from '../hotel/hotel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingRoom,
      RoomNight,
      Room,
      Guest,
      Payment,
      Invoice,
      Hotel,
    ]),
    HotelModule,
  ],
  controllers: [PublicBookingController],
  providers: [PublicBookingService, ChapaService],
  exports: [PublicBookingService, ChapaService],
})
export class PublicBookingModule {}
