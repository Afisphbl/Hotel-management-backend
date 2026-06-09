import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../../../database/entities/booking.entity';
import { Hotel } from '../../../database/entities/hotel.entity';
import { BookingsService } from '../bookings.service';

@Injectable()
export class DailyBookingProcessor {
  private readonly logger = new Logger(DailyBookingProcessor.name);

  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    private dataSource: DataSource,
    private bookingsService: BookingsService,
  ) {}

  @Cron('1 0 * * *') // 00:01 every day
  async processDailyCheckInsAndOuts() {
    const today = new Date().toISOString().split('T')[0];
    this.logger.log(`Running daily booking processor for ${today}`);

    const hotels = await this.hotelRepository.find({ select: ['id', 'schemaName'] });

    for (const hotel of hotels) {
      if (!hotel.schemaName) continue;
      await this.processHotel(hotel.id, hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, ''), today);
    }
  }

  private async processHotel(hotelId: string, schema: string, today: string) {
    // Auto check-in: CONFIRMED bookings with checkIn = today
    const checkIns = await this.dataSource.query(
      `SELECT id FROM "${schema}".bookings
       WHERE status = 'CONFIRMED' AND "checkIn"::date = $1::date AND "deletedAt" IS NULL`,
      [today],
    );

    for (const { id } of checkIns) {
      try {
        await this.bookingsService.checkin(id, hotelId);
        this.logger.log(`Auto checked-in booking ${id} (hotel ${hotelId})`);
      } catch (err) {
        this.logger.warn(`Failed auto check-in for booking ${id}: ${err.message}`);
      }
    }

    // Auto check-out: CHECKED_IN bookings with checkOut = today
    const checkOuts = await this.dataSource.query(
      `SELECT id FROM "${schema}".bookings
       WHERE status = 'CHECKED_IN' AND "checkOut"::date = $1::date AND "deletedAt" IS NULL`,
      [today],
    );

    for (const { id } of checkOuts) {
      try {
        await this.bookingsService.checkout(id, hotelId);
        this.logger.log(`Auto checked-out booking ${id} (hotel ${hotelId})`);
      } catch (err) {
        this.logger.warn(`Failed auto check-out for booking ${id}: ${err.message}`);
      }
    }

    this.logger.log(
      `Hotel ${hotelId}: ${checkIns.length} check-ins, ${checkOuts.length} check-outs processed`,
    );
  }
}
