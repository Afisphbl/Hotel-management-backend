import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Booking, BookingStatus } from '../../../database/entities/booking.entity';
import { RoomNight, RoomNightStatus } from '../../../database/entities/room-night.entity';
import { OutboxEvent } from '../../../database/entities/outbox-event.entity';
import { Guest } from '../../../database/entities/guest.entity';
import { Room } from '../../../database/entities/room.entity';
import { PricingService } from './pricing.service';
import { PaginatedResult, paginateQuery } from '../common/pagination.helper';
import { AuditLog, AuditAction, AuditResource } from '../../../database/entities/audit-log.entity';

export class CreateBookingDto {
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export class ConfirmBookingDto {
  idempotencyKey: string;
}

export class CancelBookingDto {
  reason?: string;
}

export enum BookingAction {
  CREATE = 'create',
  CONFIRM = 'confirm',
  CANCEL = 'cancel',
  CHECKIN = 'checkin',
  CHECKOUT = 'checkout',
  NOSHOW = 'noshow',
}

@Injectable()
export class BookingsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(RoomNight)
    private roomNightRepository: Repository<RoomNight>,
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private pricingService: PricingService,
    @InjectQueue('hold-expiry') private holdExpiryQueue: Queue,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    guestId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResult<Booking>> {
    const qb = this.bookingRepository.createQueryBuilder('booking')
      .leftJoinAndSelect('booking.guest', 'guest')
      .orderBy('booking.createdAt', 'DESC');

    if (options.status) qb.andWhere('booking.status = :status', { status: options.status });
    if (options.guestId) qb.andWhere('booking.guestId = :guestId', { guestId: options.guestId });
    if (options.dateFrom) qb.andWhere('booking.checkIn >= :dateFrom', { dateFrom: options.dateFrom });
    if (options.dateTo) qb.andWhere('booking.checkOut <= :dateTo', { dateTo: options.dateTo });

    return paginateQuery(qb, options.page, options.limit);
  }

  async findById(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['guest'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async create(dto: CreateBookingDto, userId: string): Promise<Booking> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await this.bookingRepository.findOneBy({
        idempotencyKey: dto.idempotencyKey,
      });
      if (existing) return existing;

      const guest = await this.guestRepository.findOneBy({ id: dto.guestId });
      if (!guest) throw new NotFoundException('Guest not found');

      const room = await this.roomRepository.findOne({
        where: { id: dto.roomId },
        relations: ['roomType'],
      });
      if (!room) throw new NotFoundException('Room not found');

      const dates = this.getDatesBetween(dto.checkIn, dto.checkOut);

      const conflictingNights = await queryRunner.manager
        .createQueryBuilder(RoomNight, 'rn')
        .setLock('pessimistic_write')
        .where('rn.roomId = :roomId AND rn.date IN (:...dates)', {
          roomId: dto.roomId,
          dates,
        })
        .andWhere('rn.status IN (:...statuses)', {
          statuses: [RoomNightStatus.HELD, RoomNightStatus.BOOKED],
        })
        .getMany();

      if (conflictingNights.length > 0) {
        throw new ConflictException('Room is not available for selected dates');
      }

      let total = 0;
      const roomNights: RoomNight[] = [];
      for (const date of dates) {
        const price = await this.pricingService.calculatePrice(
          room.roomTypeId,
          new Date(date),
        );
        total += price;

        const rn = queryRunner.manager.create(RoomNight, {
          roomId: dto.roomId,
          date,
          status: RoomNightStatus.HELD,
          price,
        } as any);
        roomNights.push(rn);
      }

      const booking = queryRunner.manager.create(Booking, {
        guestId: dto.guestId,
        checkIn: new Date(dto.checkIn),
        checkOut: new Date(dto.checkOut),
        status: BookingStatus.HOLD,
        totalPrice: total,
        idempotencyKey: dto.idempotencyKey,
        priceSnapshot: {
          roomTypeId: room.roomTypeId,
          roomTypeName: room.roomType?.name,
          roomNumber: room.roomNumber,
          nights: roomNights.map((rn) => ({ date: rn.date, price: rn.price })),
          pricingDate: new Date().toISOString(),
        },
      });

      const savedBooking = await queryRunner.manager.save(booking);

      for (const rn of roomNights) {
        rn.bookingId = savedBooking.id;
        await queryRunner.manager.save(rn);
      }

      const outbox = queryRunner.manager.create(OutboxEvent, {
        type: 'BOOKING_CREATED',
        payload: { bookingId: savedBooking.id, guestId: savedBooking.guestId },
      });
      await queryRunner.manager.save(outbox);

      const audit = queryRunner.manager.create(AuditLog, {
        userId,
        action: AuditAction.BOOKING_CREATE,
        resourceType: AuditResource.BOOKING,
        resourceId: savedBooking.id,
        newValues: { status: BookingStatus.HOLD, totalPrice: total, checkIn: dto.checkIn, checkOut: dto.checkOut },
        performedBy: userId,
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();

      await this.holdExpiryQueue.add('hold-expiry', { bookingId: savedBooking.id }, { delay: 15 * 60 * 1000 });

      return savedBooking;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async confirm(id: string, dto: ConfirmBookingDto, userId: string): Promise<Booking> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const booking = await queryRunner.manager.findOne(Booking, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status !== BookingStatus.HOLD) {
        throw new BadRequestException('Booking must be in HOLD status to confirm');
      }
      if (booking.idempotencyKey === dto.idempotencyKey && dto.idempotencyKey) {
        return booking;
      }

      booking.status = BookingStatus.CONFIRMED;
      const saved = await queryRunner.manager.save(booking);

      await queryRunner.manager.update(
        RoomNight,
        { bookingId: id, status: RoomNightStatus.HELD },
        { status: RoomNightStatus.BOOKED },
      );

      const outbox = queryRunner.manager.create(OutboxEvent, {
        type: 'BOOKING_CONFIRMED',
        payload: { bookingId: id },
      });
      await queryRunner.manager.save(outbox);

      const audit = queryRunner.manager.create(AuditLog, {
        userId,
        action: AuditAction.BOOKING_CREATE,
        resourceType: AuditResource.BOOKING,
        resourceId: id,
        newValues: { status: BookingStatus.CONFIRMED },
        oldValues: { status: BookingStatus.HOLD },
        performedBy: userId,
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(id: string, _dto: CancelBookingDto, userId: string): Promise<Booking> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const booking = await queryRunner.manager.findOne(Booking, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === BookingStatus.CANCELLED) return booking;

      const oldStatus = booking.status;
      booking.status = BookingStatus.CANCELLED;
      const saved = await queryRunner.manager.save(booking);

      await queryRunner.manager.update(
        RoomNight,
        { bookingId: id },
        { status: RoomNightStatus.HELD }, // Release back to available
      );

      const outbox = queryRunner.manager.create(OutboxEvent, {
        type: 'BOOKING_CANCELLED',
        payload: { bookingId: id, previousStatus: oldStatus },
      });
      await queryRunner.manager.save(outbox);

      const audit = queryRunner.manager.create(AuditLog, {
        userId,
        action: AuditAction.BOOKING_CANCEL,
        resourceType: AuditResource.BOOKING,
        resourceId: id,
        oldValues: { status: oldStatus },
        newValues: { status: BookingStatus.CANCELLED },
        performedBy: userId,
      });
      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async checkin(id: string, userId: string): Promise<Booking> {
    return this.transitionStatus(id, BookingStatus.CHECKED_IN, userId, AuditAction.BOOKING_UPDATE);
  }

  async checkout(id: string, userId: string): Promise<Booking> {
    return this.transitionStatus(id, BookingStatus.CHECKED_OUT, userId, AuditAction.BOOKING_UPDATE);
  }

  private async transitionStatus(
    id: string,
    newStatus: BookingStatus,
    userId: string,
    auditAction: AuditAction,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOneBy({ id });
    if (!booking) throw new NotFoundException('Booking not found');

    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.HOLD],
      [BookingStatus.HOLD]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NOSHOW],
      [BookingStatus.CHECKED_IN]: [BookingStatus.CHECKED_OUT],
      [BookingStatus.CHECKED_OUT]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.NOSHOW]: [],
    };

    const allowed = validTransitions[booking.status];
    if (!allowed?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${newStatus}`,
      );
    }

    const oldStatus = booking.status;
    booking.status = newStatus;
    const saved = await this.bookingRepository.save(booking);

    await this.auditLogRepository.save({
      userId,
      action: auditAction,
      resourceType: AuditResource.BOOKING,
      resourceId: id,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      performedBy: userId,
    });

    if (newStatus === BookingStatus.CHECKED_IN) {
      await this.roomNightRepository.update(
        { bookingId: id },
        { status: RoomNightStatus.BOOKED },
      );
    }

    return saved;
  }

  private getDatesBetween(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const curr = new Date(startDate);
    const last = new Date(endDate);
    while (curr < last) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }
}
