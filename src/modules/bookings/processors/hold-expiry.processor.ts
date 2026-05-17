import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  Booking,
  BookingStatus,
} from '../../../database/entities/booking.entity';
import {
  RoomNight,
  RoomNightStatus,
} from '../../../database/entities/room-night.entity';

@Processor('hold-expiry')
export class HoldExpiryProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(RoomNight)
    private roomNightRepository: Repository<RoomNight>,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { bookingId } = job.data;

    const booking = await this.bookingRepository.findOneBy({ id: bookingId });
    if (booking && booking.status === BookingStatus.HOLD) {
      // Check if 15 minutes have passed
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (booking.createdAt < fifteenMinutesAgo) {
        booking.status = BookingStatus.CANCELLED;
        await this.bookingRepository.save(booking);

        // Release room nights
        await this.roomNightRepository.update(
          { bookingId },
          { status: RoomNightStatus.HELD }, // Or delete if appropriate
        );
      }
    }
  }
}
