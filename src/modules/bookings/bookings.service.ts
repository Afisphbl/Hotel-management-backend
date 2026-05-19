import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  SelectQueryBuilder,
  ObjectLiteral,
} from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';
import { BookingRoom } from '../../database/entities/booking-room.entity';
import {
  RoomNight,
  RoomNightStatus,
} from '../../database/entities/room-night.entity';
import { OutboxEvent } from '../../database/entities/outbox-event.entity';
import { Guest } from '../../database/entities/guest.entity';
import { Room } from '../../database/entities/room.entity';
import { PricingService } from './pricing.service';
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from '../../database/entities/audit-log.entity';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class BookingsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(BookingRoom)
    private bookingRoomRepository: Repository<BookingRoom>,
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

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    guestId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResult<Booking>> {
    const qb = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.guest', 'guest')
      .leftJoinAndSelect('booking.bookingRooms', 'bookingRooms')
      .leftJoinAndSelect('bookingRooms.room', 'room')
      .orderBy('booking.createdAt', 'DESC');

    if (query.status)
      qb.andWhere('booking.status = :status', { status: query.status });
    if (query.guestId)
      qb.andWhere('booking.guestId = :guestId', { guestId: query.guestId });
    if (query.dateFrom)
      qb.andWhere('booking.checkIn >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo)
      qb.andWhere('booking.checkOut <= :dateTo', { dateTo: query.dateTo });

    return this.paginateQuery(qb, query.page, query.limit);
  }

  async findById(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['guest', 'bookingRooms', 'bookingRooms.room'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async createBooking(createDto: {
    guestId: string;
    roomIds: string[];
    checkIn: string;
    checkOut: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    userId?: string;
  }): Promise<Booking> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(Booking, {
        where: { idempotencyKey: createDto.idempotencyKey },
      });
      if (existing) {
        await queryRunner.rollbackTransaction();
        return existing;
      }

      const guest = await queryRunner.manager.findOne(Guest, {
        where: { id: createDto.guestId },
      });
      if (!guest) throw new NotFoundException('Guest not found');

      const rooms = await queryRunner.manager.find(Room, {
        where: createDto.roomIds.map((id) => ({ id })),
        relations: ['roomType'],
      });
      if (rooms.length !== createDto.roomIds.length) {
        throw new NotFoundException('One or more rooms not found');
      }

      const dates = this.getDatesBetween(createDto.checkIn, createDto.checkOut);

      for (const room of rooms) {
        const conflictingNights = await queryRunner.manager
          .createQueryBuilder(RoomNight, 'rn')
          .setLock('pessimistic_write')
          .where('rn.roomId = :roomId AND rn.date IN (:...dates)', {
            roomId: room.id,
            dates,
          })
          .andWhere('rn.status IN (:...statuses)', {
            statuses: [RoomNightStatus.HELD, RoomNightStatus.BOOKED],
          })
          .getMany();

        if (conflictingNights.length > 0) {
          throw new ConflictException(
            `Room ${room.roomNumber} is not available for selected dates`,
          );
        }
      }

      let total = 0;
      const allRoomNights: RoomNight[] = [];
      const bookingRoomsData: {
        room: Room;
        nightPrices: { date: string; price: number }[];
      }[] = [];

      for (const room of rooms) {
        const nightPrices: { date: string; price: number }[] = [];

        for (const date of dates) {
          const price = await this.pricingService.calculatePrice(
            room.roomTypeId,
            new Date(date),
          );
          total += price;

          nightPrices.push({ date, price });

          const rn = queryRunner.manager.create(RoomNight, {
            roomId: room.id,
            date,
            status: RoomNightStatus.HELD,
            price,
          });
          allRoomNights.push(rn);
        }

        bookingRoomsData.push({ room, nightPrices });
      }

      const booking = queryRunner.manager.create(Booking, {
        guestId: createDto.guestId,
        checkIn: new Date(createDto.checkIn),
        checkOut: new Date(createDto.checkOut),
        status: BookingStatus.HOLD,
        totalPrice: total,
        idempotencyKey: createDto.idempotencyKey,
        priceSnapshot: {
          rooms: bookingRoomsData.map((br) => ({
            roomTypeId: br.room.roomTypeId,
            roomNumber: br.room.roomNumber,
            nights: br.nightPrices,
          })),
          pricingDate: new Date().toISOString(),
        },
      });

      const savedBooking = await queryRunner.manager.save(booking);

      for (const rn of allRoomNights) {
        rn.bookingId = savedBooking.id;
        await queryRunner.manager.save(rn);
      }

      for (const br of bookingRoomsData) {
        const bookingRoom = queryRunner.manager.create(BookingRoom, {
          bookingId: savedBooking.id,
          roomId: br.room.id,
          price: br.nightPrices.reduce((s, n) => s + n.price, 0),
          nightPrices: br.nightPrices,
        });
        await queryRunner.manager.save(bookingRoom);
      }

      const outbox = queryRunner.manager.create(OutboxEvent, {
        type: 'BOOKING_CREATED',
        payload: { bookingId: savedBooking.id, guestId: savedBooking.guestId },
      });
      await queryRunner.manager.save(outbox);

      if (createDto.userId) {
        const audit = queryRunner.manager.create(AuditLog, {
          userId: createDto.userId,
          action: AuditAction.BOOKING_CREATE,
          resourceType: AuditResource.BOOKING,
          resourceId: savedBooking.id,
          newValues: { status: BookingStatus.HOLD, totalPrice: total },
          performedBy: createDto.userId,
        });
        await queryRunner.manager.save(audit);
      }

      await queryRunner.commitTransaction();

      await this.holdExpiryQueue.add(
        'hold-expiry',
        { bookingId: savedBooking.id },
        { delay: 15 * 60 * 1000 },
      );

      return savedBooking;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async confirm(
    id: string,
    idempotencyKey: string,
    userId?: string,
  ): Promise<Booking> {
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
        throw new BadRequestException(
          'Booking must be in HOLD status to confirm',
        );
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

      if (userId) {
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
      }

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(id: string, reason?: string, userId?: string): Promise<Booking> {
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

      await queryRunner.manager.delete(RoomNight, { bookingId: id });

      const outbox = queryRunner.manager.create(OutboxEvent, {
        type: 'BOOKING_CANCELLED',
        payload: { bookingId: id, previousStatus: oldStatus, reason },
      });
      await queryRunner.manager.save(outbox);

      if (userId) {
        const audit = queryRunner.manager.create(AuditLog, {
          userId,
          action: AuditAction.BOOKING_CANCEL,
          resourceType: AuditResource.BOOKING,
          resourceId: id,
          oldValues: { status: oldStatus },
          newValues: { status: BookingStatus.CANCELLED, reason },
          performedBy: userId,
        });
        await queryRunner.manager.save(audit);
      }

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async checkin(id: string, userId?: string): Promise<Booking> {
    return this.transitionStatus(id, BookingStatus.CHECKED_IN, userId);
  }

  async checkout(id: string, userId?: string): Promise<Booking> {
    return this.transitionStatus(id, BookingStatus.CHECKED_OUT, userId);
  }

  private async transitionStatus(
    id: string,
    newStatus: BookingStatus,
    userId?: string,
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOneBy({ id });
    if (!booking) throw new NotFoundException('Booking not found');

    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.HOLD, BookingStatus.CANCELLED],
      [BookingStatus.HOLD]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CHECKED_IN,
        BookingStatus.CANCELLED,
        BookingStatus.NOSHOW,
      ],
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

    if (newStatus === BookingStatus.CHECKED_IN) {
      await this.roomNightRepository.update(
        { bookingId: id },
        { status: RoomNightStatus.BOOKED },
      );
    }

    if (userId) {
      await this.auditLogRepository.save({
        userId,
        action: AuditAction.BOOKING_UPDATE,
        resourceType: AuditResource.BOOKING,
        resourceId: id,
        oldValues: { status: oldStatus },
        newValues: { status: newStatus },
        performedBy: userId,
      });
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

  private async paginateQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResult<T>> {
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
