import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { RoomNight, RoomNightStatus } from '../../database/entities/room-night.entity';
import { OutboxEvent, OutboxStatus } from '../../database/entities/outbox-event.entity';
import { PricingService } from './pricing.service';

@Injectable()
export class BookingsService {
  constructor(
    private dataSource: DataSource,
    private pricingService: PricingService,
  ) {}

  async createBooking(createDto: any): Promise<Booking> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate availability and lock room_nights
      const dates = this.getDatesBetween(createDto.checkIn, createDto.checkOut);
      
      const availability = await queryRunner.manager
        .createQueryBuilder(RoomNight, 'rn')
        .setLock('pessimistic_write')
        .where('rn.roomId = :roomId AND rn.date IN (:...dates)', {
          roomId: createDto.roomId,
          dates,
        })
        .getMany();

      if (availability.length > 0) {
        throw new ConflictException('Room is not available for selected dates');
      }

      // 2. Calculate Price
      let total = 0;
      const roomNights: RoomNight[] = [];
      for (const date of dates) {
        const price = await this.pricingService.calculatePrice(createDto.roomTypeId, new Date(date));
        total += price;
        
        const rn = new RoomNight();
        rn.roomId = createDto.roomId;
        rn.date = date;
        rn.status = RoomNightStatus.HELD;
        rn.price = price;
        roomNights.push(rn);
      }

      // 3. Create Booking
      const booking = new Booking();
      booking.guestId = createDto.guestId;
      booking.checkIn = new Date(createDto.checkIn);
      booking.checkOut = new Date(createDto.checkOut);
      booking.status = BookingStatus.HOLD;
      booking.totalPrice = total;
      booking.idempotencyKey = createDto.idempotencyKey;
      
      const savedBooking = await queryRunner.manager.save(booking);

      // 4. Update Room Nights with Booking ID
      for (const rn of roomNights) {
        rn.bookingId = savedBooking.id;
        await queryRunner.manager.save(rn);
      }

      // 5. Insert Outbox Event
      const outbox = new OutboxEvent();
      outbox.type = 'BOOKING_CREATED';
      outbox.payload = { bookingId: savedBooking.id, guestId: savedBooking.guestId };
      await queryRunner.manager.save(outbox);

      await queryRunner.commitTransaction();
      return savedBooking;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private getDatesBetween(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let curr = new Date(startDate);
    const last = new Date(endDate);
    while (curr < last) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }
}
