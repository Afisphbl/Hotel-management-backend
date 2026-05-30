import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking, BookingStatus } from '../../../database/entities/booking.entity';
import { Notification, NotificationType, NotificationStatus, NotificationChannel } from '../../../database/entities/notification.entity';
import { BookingRoom } from '../../../database/entities/booking-room.entity';
import { Room } from '../../../database/entities/room.entity';
import { Hotel } from '../../../database/entities/hotel.entity';

@Processor('booking-reminders')
export class BookingReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingReminderProcessor.name);

  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(BookingRoom)
    private bookingRoomRepository: Repository<BookingRoom>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log('Processing daily booking reminders...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const arrivals = await this.bookingRepository.find({
      where: {
        checkIn: Between(today, tomorrow),
        status: BookingStatus.CONFIRMED,
      },
      relations: ['guest'],
    });

    const departures = await this.bookingRepository.find({
      where: {
        checkOut: Between(today, tomorrow),
        status: BookingStatus.CHECKED_IN,
      },
      relations: ['guest'],
    });

    const inHouse = await this.bookingRepository.find({
      where: {
        checkIn: Between(today, tomorrow),
        status: BookingStatus.CHECKED_IN,
      },
      relations: ['guest'],
    });

    for (const booking of arrivals) {
      const notified = await this.createNotification(
        booking,
        'Arriving Today',
        `Guest ${booking.guest?.firstName ?? 'N/A'} ${booking.guest?.lastName ?? ''} is checking in today.`,
        NotificationType.BOOKING_CHECKED_IN,
      );
      if (notified) this.logger.log(`Arrival reminder: booking ${booking.id}`);
    }

    for (const booking of departures) {
      const notified = await this.createNotification(
        booking,
        'Departing Today',
        `Guest ${booking.guest?.firstName ?? 'N/A'} ${booking.guest?.lastName ?? ''} is checking out today.`,
        NotificationType.BOOKING_CHECKED_OUT,
      );
      if (notified) this.logger.log(`Departure reminder: booking ${booking.id}`);
    }

    for (const booking of inHouse) {
      const notified = await this.createNotification(
        booking,
        'Checked In Today',
        `Guest ${booking.guest?.firstName ?? 'N/A'} ${booking.guest?.lastName ?? ''} has checked in today.`,
        NotificationType.BOOKING_CHECKED_IN,
      );
      if (notified) this.logger.log(`In-house reminder: booking ${booking.id}`);
    }

    return { arrivals: arrivals.length, departures: departures.length, inHouse: inHouse.length };
  }

  private async createNotification(
    booking: Booking,
    title: string,
    body: string,
    type: NotificationType,
  ): Promise<boolean> {
    try {
      const hotel = await this.getHotelForBooking(booking.id);
      const userIds = hotel
        ? await this.getHotelUserIds(hotel)
        : [];

      if (!userIds.length) {
        this.logger.warn(`No users found for booking ${booking.id}`);
        return false;
      }

      const notifications = userIds.map((userId) =>
        this.notificationRepository.create({
          userId,
          type,
          title,
          body,
          data: { bookingId: booking.id, guestId: booking.guestId },
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.SENT,
          sentAt: new Date(),
        }),
      );

      await this.notificationRepository.save(notifications);
      return true;
    } catch (err) {
      this.logger.error(`Failed to create notification: ${err.message}`);
      return false;
    }
  }

  private async getHotelForBooking(bookingId: string): Promise<Hotel | null> {
    const bookingRoom = await this.bookingRoomRepository.findOne({
      where: { bookingId },
      relations: ['room'],
    });
    if (!bookingRoom?.room?.hotelId) return null;
    return this.hotelRepository.findOneBy({ id: bookingRoom.room.hotelId });
  }

  private async getHotelUserIds(hotel: Hotel): Promise<string[]> {
    const user = await this.hotelRepository.manager.query(
      `SELECT id FROM global.users WHERE email = $1 AND "isActive" = true LIMIT 1`,
      [hotel.ownerEmail],
    );
    return user?.length ? [user[0].id] : [];
  }
}
