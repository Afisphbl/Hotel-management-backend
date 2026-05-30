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
import { Hotel } from '../../database/entities/hotel.entity';
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
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private pricingService: PricingService,
    @InjectQueue('hold-expiry') private holdExpiryQueue: Queue,
  ) {}

  private schemaCache = new Map<string, string>();

  private async getSchema(hotelId: string): Promise<string> {
    if (this.schemaCache.has(hotelId)) return this.schemaCache.get(hotelId)!;
    const hotel = await this.hotelRepository.findOne({ where: { id: hotelId } });
    const schema = hotel?.schemaName?.replace(/[^a-zA-Z0-9_]/g, '') ?? 'public';
    this.schemaCache.set(hotelId, schema);
    return schema;
  }

  async calculatePricePreview(dto: {
    roomIds: string[];
    checkIn: string;
    checkOut: string;
  }): Promise<{
    total: number;
    nights: number;
    rooms: { roomId: string; roomNumber: string; roomType: { id: string; name: string } | null; total: number; nights: { date: string; price: number }[] }[];
  }> {
    const rooms = await this.roomRepository.find({
      where: dto.roomIds.map((id) => ({ id })),
      relations: ['roomType'],
    });
    if (rooms.length !== dto.roomIds.length) {
      throw new NotFoundException('One or more rooms not found');
    }

    const dates = this.getDatesBetween(dto.checkIn, dto.checkOut);
    let total = 0;
    const roomBreakdowns: { roomId: string; roomNumber: string; roomType: { id: string; name: string } | null; total: number; nights: { date: string; price: number }[] }[] = [];

    for (const room of rooms) {
      const nightPrices: { date: string; price: number }[] = [];
      for (const date of dates) {
        const price = await this.pricingService.calculatePrice(
          room.hotelId,
          room.roomTypeId,
          new Date(date),
          { roomBasePrice: room.basePrice },
        );
        total += price;
        nightPrices.push({ date, price });
      }
      roomBreakdowns.push({
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType ? { id: room.roomType.id, name: room.roomType.name } : null,
        total: nightPrices.reduce((s, n) => s + n.price, 0),
        nights: nightPrices,
      });
    }

    return { total, nights: dates.length, rooms: roomBreakdowns };
  }

  async findAll(query: {
    hotelId: string;
    page?: number;
    limit?: number;
    status?: BookingStatus;
    guestId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResult<any>> {
    const s = await this.getSchema(query.hotelId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (query.status) { conditions.push(`b.status = $${i++}`); params.push(query.status); }
    if (query.guestId) { conditions.push(`b."guestId" = $${i++}`); params.push(query.guestId); }
    if (query.dateFrom) { conditions.push(`b."checkIn" >= $${i++}`); params.push(query.dateFrom); }
    if (query.dateTo) { conditions.push(`b."checkOut" <= $${i++}`); params.push(query.dateTo); }
    if (query.search) {
      conditions.push(`(LOWER(g."firstName") LIKE LOWER($${i}) OR LOWER(g."lastName") LIKE LOWER($${i}) OR LOWER(g.email) LIKE LOWER($${i}) OR LOWER(b.id::text) LIKE LOWER($${i}))`);
      params.push(`%${query.search}%`); i++;
    }

    const andCond = conditions.length ? 'AND ' + conditions.join(' AND ') : '';

    const rows = await this.dataSource.query(
      `SELECT b.id, b."guestId", b."checkIn", b."checkOut", b.status, b."totalPrice",
        b.source, b.notes, b."createdAt", b."updatedAt", b."priceSnapshot",
        g."firstName", g."lastName", g.email, g.phone,
        json_agg(json_build_object(
          'id', br.id, 'roomId', br."roomId", 'roomTypeId', br."roomTypeId", 'price', br.price, 'nightPrices', br."nightPrices",
          'room', json_build_object('id', r.id, 'roomNumber', r."roomNumber", 'floor', r.floor,
            'roomType', json_build_object('id', rt.id, 'name', rt.name))
        )) FILTER (WHERE br.id IS NOT NULL) AS "bookingRooms"
      FROM "${s}".bookings b
      LEFT JOIN "${s}".guests g ON g.id = b."guestId"
      LEFT JOIN "${s}".booking_rooms br ON br."bookingId" = b.id AND br."deletedAt" IS NULL
      LEFT JOIN "${s}".rooms r ON r.id = br."roomId"
      LEFT JOIN "${s}".room_types rt ON rt.id = COALESCE(br."roomTypeId", r."roomTypeId")
      GROUP BY b.id, g."firstName", g."lastName", g.email, g.phone
      ORDER BY b."createdAt" DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset],
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT b.id) as count FROM "${s}".bookings b
       LEFT JOIN "${s}".guests g ON g.id = b."guestId"
       WHERE b."deletedAt" IS NULL ${andCond}`,
      params,
    );

    const items = rows.map((r: any) => ({
      id: r.id, guestId: r.guestId, checkIn: r.checkIn, checkOut: r.checkOut,
      status: r.status, totalPrice: r.totalPrice, source: r.source, notes: r.notes,
      createdAt: r.createdAt, updatedAt: r.updatedAt, priceSnapshot: r.priceSnapshot,
      guest: { firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone },
      bookingRooms: r.bookingRooms ?? [],
    }));

    return { items, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  }

  async findById(id: string, hotelId: string): Promise<any> {
    const s = await this.getSchema(hotelId);
      const rows = await this.dataSource.query(
        `SELECT b.id, b."guestId", b."checkIn", b."checkOut", b.status, b."totalPrice",
          b.source, b.notes, b."createdAt", b."updatedAt", b."priceSnapshot",
          g."firstName", g."lastName", g.email, g.phone,
          json_agg(json_build_object(
            'id', br.id, 'roomId', br."roomId", 'roomTypeId', br."roomTypeId", 'price', br.price, 'nightPrices', br."nightPrices",
            'room', json_build_object('id', r.id, 'roomNumber', r."roomNumber", 'floor', r.floor,
              'roomType', json_build_object('id', rt.id, 'name', rt.name))
          )) FILTER (WHERE br.id IS NOT NULL) AS "bookingRooms"
        FROM "${s}".bookings b
        LEFT JOIN "${s}".guests g ON g.id = b."guestId"
        LEFT JOIN "${s}".booking_rooms br ON br."bookingId" = b.id AND br."deletedAt" IS NULL
        LEFT JOIN "${s}".rooms r ON r.id = br."roomId"
        LEFT JOIN "${s}".room_types rt ON rt.id = COALESCE(br."roomTypeId", r."roomTypeId")
        WHERE b.id = $1 AND b."deletedAt" IS NULL
        GROUP BY b.id, g."firstName", g."lastName", g.email, g.phone`,
        [id],
      );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const r = rows[0];
    return {
      id: r.id, guestId: r.guestId, checkIn: r.checkIn, checkOut: r.checkOut,
      status: r.status, totalPrice: r.totalPrice, source: r.source, notes: r.notes,
      createdAt: r.createdAt, updatedAt: r.updatedAt, priceSnapshot: r.priceSnapshot,
      guest: { firstName: r.firstName, lastName: r.lastName, email: r.email, phone: r.phone },
      bookingRooms: r.bookingRooms ?? [],
    };
  }

  async createBooking(createDto: {
    guestId: string;
    roomIds: string[];
    checkIn: string;
    checkOut: string;
    idempotencyKey: string;
    source?: string;
    notes?: string;
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
            room.hotelId,
            room.roomTypeId,
            new Date(date),
            { roomBasePrice: room.basePrice },
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
        source: createDto.source || 'direct',
        notes: createDto.notes || undefined,
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
          roomTypeId: br.room.roomTypeId,
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

  async updateBooking(
    id: string,
    dto: {
      notes?: string;
      source?: string;
      checkIn?: string;
      checkOut?: string;
      roomIds?: string[];
    },
    hotelId: string,
    userId?: string,
  ): Promise<any> {
    const booking = await this.bookingRepository.findOne({ where: { id }, relations: ['bookingRooms'] });
    if (!booking) throw new NotFoundException('Booking not found');

    const editableStatuses = [BookingStatus.PENDING, BookingStatus.HOLD, BookingStatus.CONFIRMED];
    if (!editableStatuses.includes(booking.status)) {
      throw new BadRequestException('Booking cannot be edited in its current status');
    }

    const hasDateChange = dto.checkIn || dto.checkOut;
    const hasRoomChange = dto.roomIds !== undefined;

    if (hasDateChange || hasRoomChange) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const newCheckIn = dto.checkIn ? new Date(dto.checkIn) : booking.checkIn;
        const newCheckOut = dto.checkOut ? new Date(dto.checkOut) : booking.checkOut;
        const newRoomIds = dto.roomIds ?? (booking.bookingRooms?.map((br) => br.roomId) ?? []);

        if (newCheckOut <= newCheckIn) {
          throw new BadRequestException('Check-out must be after check-in');
        }

        const rooms = await queryRunner.manager.find(Room, {
          where: newRoomIds.map((rid) => ({ id: rid })),
          relations: ['roomType'],
        });
        if (rooms.length !== newRoomIds.length) {
          throw new NotFoundException('One or more rooms not found');
        }

        const dates = this.getDatesBetween(
          newCheckIn.toISOString().split('T')[0],
          newCheckOut.toISOString().split('T')[0],
        );

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
            .andWhere('(rn."bookingId" IS NULL OR rn."bookingId" != :bookingId)', {
              bookingId: id,
            })
            .getMany();

          if (conflictingNights.length > 0) {
            throw new ConflictException(
              `Room ${room.roomNumber} is not available for selected dates`,
            );
          }
        }

        // Delete old room_nights and booking_rooms
        await queryRunner.manager.delete(RoomNight, { bookingId: id });
        await queryRunner.manager.delete(BookingRoom, { bookingId: id });

        // Calculate new prices and create records
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
              hotelId,
              room.roomTypeId,
              new Date(date),
              { roomBasePrice: room.basePrice },
            );
            total += price;
            nightPrices.push({ date, price });

            const rn = queryRunner.manager.create(RoomNight, {
              roomId: room.id,
              date,
              bookingId: id,
              status:
                booking.status === BookingStatus.CONFIRMED
                  ? RoomNightStatus.BOOKED
                  : RoomNightStatus.HELD,
              price,
            });
            allRoomNights.push(rn);
          }
          bookingRoomsData.push({ room, nightPrices });
        }

        await queryRunner.manager.save(allRoomNights);

        for (const br of bookingRoomsData) {
          const bookingRoom = queryRunner.manager.create(BookingRoom, {
            bookingId: id,
            roomId: br.room.id,
            roomTypeId: br.room.roomTypeId,
            price: br.nightPrices.reduce((s, n) => s + n.price, 0),
            nightPrices: br.nightPrices,
          });
          await queryRunner.manager.save(bookingRoom);
        }

        booking.checkIn = newCheckIn;
        booking.checkOut = newCheckOut;
        booking.totalPrice = total;
        booking.priceSnapshot = {
          rooms: bookingRoomsData.map((br) => ({
            roomTypeId: br.room.roomTypeId,
            roomNumber: br.room.roomNumber,
            nights: br.nightPrices,
          })),
          pricingDate: new Date().toISOString(),
        };

        if (dto.notes !== undefined) booking.notes = dto.notes;
        if (dto.source !== undefined) booking.source = dto.source;

        await queryRunner.manager.save(booking);

        if (userId) {
          const audit = queryRunner.manager.create(AuditLog, {
            userId,
            action: AuditAction.BOOKING_UPDATE,
            resourceType: AuditResource.BOOKING,
            resourceId: id,
            newValues: { checkIn: newCheckIn, checkOut: newCheckOut, roomIds: newRoomIds, totalPrice: total },
            performedBy: userId,
          });
          await queryRunner.manager.save(audit);
        }

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } else {
      // Only notes/source changed
      if (dto.notes !== undefined) booking.notes = dto.notes;
      if (dto.source !== undefined) booking.source = dto.source;
      await this.bookingRepository.save(booking);

      if (userId) {
        await this.auditLogRepository.save({
          userId,
          action: AuditAction.BOOKING_UPDATE,
          resourceType: AuditResource.BOOKING,
          resourceId: id,
          newValues: dto,
          performedBy: userId,
        });
      }
    }

    return this.findById(id, hotelId);
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

  async transitionStatus(
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
