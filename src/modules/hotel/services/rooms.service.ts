import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { validateSchemaName } from '../../../common/utils/security.utils';
import { Room, RoomStatus } from '../../../database/entities/room.entity';
import { Hotel } from '../../../database/entities/hotel.entity';
import { PaginatedResult } from '../common/pagination.helper';
import { PricingService } from './pricing.service';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => PricingService))
    private pricingService: PricingService,
  ) {}

  private async getSchema(hotelId: string): Promise<string> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel?.schemaName)
      throw new NotFoundException('Hotel schema not found');
    return validateSchemaName(hotel.schemaName);
  }

  private mapRow(r: any): Room {
    const room = new Room();
    Object.assign(room, {
      id: r.id,
      roomNumber: r.roomNumber,
      floor: r.floor,
      hotelId: r.hotelId,
      roomTypeId: r.roomTypeId,
      basePrice: r.basePrice,
      baseCapacity: r.baseCapacity,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
      effectivePrice: r.effectivePrice,
      pricingReason: r.pricingReason,
      pricingType: r.pricingType,
    });
    if (r.rt_id) {
      (room as any).roomType = {
        id: r.rt_id,
        name: r.rt_name,
        baseCapacity: r.rt_baseCapacity,
        maxExtraBeds: r.rt_maxExtraBeds,
        basePrice: r.rt_basePrice,
      };
    }
    return room;
  }

  async findAll(
    hotelId: string,
    options: {
      page?: number;
      limit?: number;
      status?: RoomStatus;
      floor?: string;
      roomTypeId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<PaginatedResult<Room>> {
    const s = await this.getSchema(hotelId);
    const page = options.page || 1;
    const limit = options.limit || 12;
    const offset = (page - 1) * limit;

    const conditions = ['"r"."deletedAt" IS NULL', `"r"."hotelId" = $1`];
    const params: any[] = [hotelId];

    if (options.status) {
      params.push(options.status);
      conditions.push(`"r"."status" = $${params.length}`);
    }
    if (options.floor) {
      params.push(options.floor);
      conditions.push(`"r"."floor" = $${params.length}`);
    }
    if (options.roomTypeId) {
      params.push(options.roomTypeId);
      conditions.push(`"r"."roomTypeId" = $${params.length}`);
    }

    if (options.dateFrom && options.dateTo) {
      const dates = this.getDatesBetween(options.dateFrom, options.dateTo);
      conditions.push(
        `"r"."id" NOT IN (SELECT rn."roomId" FROM "${s}"."room_nights" rn WHERE rn.date = ANY($${params.length + 1}::date[]) AND rn.status IN ('booked', 'held'))`,
      );
      params.push(dates);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT r.*, rt.id AS rt_id, rt.name AS rt_name, rt."baseCapacity" AS rt_baseCapacity,
                rt."maxExtraBeds" AS rt_maxExtraBeds, rt."basePrice" AS rt_basePrice
         FROM "${s}"."rooms" r
         LEFT JOIN "${s}"."room_types" rt ON rt.id = r."roomTypeId" AND rt."deletedAt" IS NULL
         WHERE ${where} ORDER BY r.floor ASC, r."roomNumber" ASC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${s}"."rooms" r WHERE ${where}`,
        params,
      ),
    ]);

    // Enhance rows with dynamic pricing info
    const pricingDate = options.dateFrom ? new Date(options.dateFrom) : new Date();

    const enhancedRows = await Promise.all(
      rows.map(async (row: any) => {
        if (!row.roomTypeId) {
          // No room type — use room's own basePrice if set
          return {
            ...row,
            effectivePrice: row.basePrice != null ? Number(row.basePrice) : null,
            pricingReason: null,
            pricingType: null,
          };
        }

        const info = await this.pricingService.getEffectivePriceInfo(
          hotelId,
          row.roomTypeId,
          pricingDate,
          row.basePrice,
        );

        // If pricing service returned 0 with no reason (room type not found),
        // fall back to room's basePrice or null
        const effectivePrice =
          info.price === 0 && !info.reason && row.basePrice != null
            ? Number(row.basePrice)
            : info.price;

        return {
          ...row,
          effectivePrice,
          pricingReason: info.reason || null,
          pricingType: info.type,
        };
      }),
    );

    const total = Number(countResult[0]?.count ?? 0);
    return {
      items: enhancedRows.map((r: any) => this.mapRow(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, hotelId?: string): Promise<Room> {
    const s = await this.getSchema(hotelId!);
    const params: any[] = [id];
    let sql = `SELECT r.*, rt.id AS rt_id, rt.name AS rt_name, rt."baseCapacity" AS rt_baseCapacity,
               rt."maxExtraBeds" AS rt_maxExtraBeds, rt."basePrice" AS rt_basePrice
               FROM "${s}"."rooms" r
               LEFT JOIN "${s}"."room_types" rt ON rt.id = r."roomTypeId" AND rt."deletedAt" IS NULL
               WHERE r.id = $1 AND r."deletedAt" IS NULL`;
    if (hotelId) {
      params.push(hotelId);
      sql += ` AND r."hotelId" = $${params.length}`;
    }
    const rows = await this.dataSource.query(sql, params);
    if (!rows.length) throw new NotFoundException('Room not found');
    return this.mapRow(rows[0]);
  }

  async create(data: Partial<Room>, hotelId: string): Promise<Room> {
    const s = await this.getSchema(hotelId);
    if (data.roomTypeId) {
      const rt = await this.dataSource.query(
        `SELECT id FROM "${s}"."room_types" WHERE id = $1 AND "deletedAt" IS NULL`,
        [data.roomTypeId],
      );
      if (!rt.length) throw new NotFoundException('Room type not found');
    }
    const rows = await this.dataSource.query(
      `INSERT INTO "${s}"."rooms" ("roomNumber", floor, "hotelId", "roomTypeId", "basePrice", "baseCapacity", status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.roomNumber,
        data.floor,
        hotelId,
        data.roomTypeId ?? null,
        data.basePrice ?? null,
        data.baseCapacity ?? null,
        data.status ?? RoomStatus.AVAILABLE,
      ],
    );
    await this.syncHotelRoomCount(hotelId, s);
    return this.mapRow(rows[0]);
  }

  async update(
    id: string,
    data: Partial<Room>,
    hotelId?: string,
  ): Promise<Room> {
    const s = await this.getSchema(hotelId!);
    const fields: string[] = [];
    const params: any[] = [];
    const allowed = [
      'roomNumber',
      'floor',
      'basePrice',
      'baseCapacity',
      'status',
      'roomTypeId',
    ] as const;
    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        fields.push(`"${key}" = $${params.length}`);
      }
    }
    if (!fields.length) return this.findById(id, hotelId);
    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE "${s}"."rooms" SET ${fields.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException('Room not found');
    return this.mapRow(rows[0]);
  }

  async remove(id: string, hotelId?: string): Promise<void> {
    const s = await this.getSchema(hotelId!);
    await this.dataSource.query(
      `UPDATE "${s}"."rooms" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    if (hotelId) await this.syncHotelRoomCount(hotelId, s);
  }

  async updateStatus(
    id: string,
    status: RoomStatus,
    hotelId?: string,
  ): Promise<Room> {
    const s = await this.getSchema(hotelId!);
    const rows = await this.dataSource.query(
      `UPDATE "${s}"."rooms" SET status = $1, "updatedAt" = NOW() WHERE id = $2 AND "deletedAt" IS NULL RETURNING *`,
      [status, id],
    );
    if (!rows.length) throw new NotFoundException('Room not found');
    return this.mapRow(rows[0]);
  }

  private async syncHotelRoomCount(hotelId: string, schemaName: string) {
    const result = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schemaName}"."rooms" WHERE "deletedAt" IS NULL`,
    );
    await this.hotelRepository.update(hotelId, {
      rooms: Number(result?.[0]?.count ?? 0),
    });
  }

  async getSummary(hotelId: string) {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    const s = hotel?.schemaName ? validateSchemaName(hotel.schemaName) : null;

    const result: Record<string, number> = {
      total: 0,
      available: 0,
      occupied: 0,
      dirty: 0,
      maintenance: 0,
      out_of_order: 0,
    };

    if (s) {
      try {
        const counts = await this.dataSource.query(
          `SELECT status, COUNT(*)::int AS count FROM "${s}"."rooms" WHERE "deletedAt" IS NULL GROUP BY status`,
        );
        for (const row of counts) {
          result[row.status] = Number(row.count);
          result.total += Number(row.count);
        }
        await this.hotelRepository.update(hotelId, { rooms: result.total });
      } catch {
        /* table may not exist yet */
      }
    }

    const PLAN_LIMITS: Record<string, number> = {
      BASIC: 50,
      PROFESSIONAL: 200,
      ENTERPRISE: 9999,
    };
    let plan = 'BASIC',
      roomLimit = 50;
    try {
      const subs = await this.dataSource.query(
        `SELECT plan FROM global.subscriptions WHERE "hotelId" = $1 AND status = 'ACTIVE' ORDER BY "createdAt" DESC LIMIT 1`,
        [hotelId],
      );
      if (subs?.length) {
        plan = subs[0].plan;
        roomLimit = PLAN_LIMITS[plan] ?? 50;
      }
    } catch {
      /* fallback */
    }

    return { ...result, plan, roomLimit };
  }

  async getFullyBookedDates(
    hotelId: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    const s = await this.getSchema(hotelId);
    const dates = this.getDatesBetween(startDate, endDate);
    if (!dates.length) return [];

    // Total bookable rooms (available or occupied, not maintenance/out-of-order)
    const [{ count: totalRooms }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${s}"."rooms" WHERE "deletedAt" IS NULL AND status != 'maintenance'`,
    );
    if (!totalRooms) return [];

    const bookedNights: { date: string; count: number }[] = await this.dataSource.query(
      `SELECT date, COUNT(DISTINCT "roomId")::int AS count
       FROM "${s}"."room_nights"
WHERE date = ANY($1::date[]) AND status IN ('booked', 'held')
        GROUP BY date`,
      [dates],
    );

    return bookedNights
      .filter(n => n.count >= totalRooms)
      .map(n => n.date);
  }

  async getAvailability(
    hotelId: string,
    roomTypeId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const s = await this.getSchema(hotelId);
    const params: any[] = [];
    let sql = `SELECT r.*, rt.id AS rt_id, rt.name AS rt_name, rt."baseCapacity" AS rt_baseCapacity,
               rt."maxExtraBeds" AS rt_maxExtraBeds, rt."basePrice" AS rt_basePrice
               FROM "${s}"."rooms" r
               LEFT JOIN "${s}"."room_types" rt ON rt.id = r."roomTypeId" AND rt."deletedAt" IS NULL
               WHERE r."deletedAt" IS NULL`;
    if (roomTypeId) {
      params.push(roomTypeId);
      sql += ` AND r."roomTypeId" = $${params.length}`;
    }
    const rooms = (await this.dataSource.query(sql, params)).map((r: any) =>
      this.mapRow(r),
    );

    if (!startDate || !endDate) {
      return rooms.map((r: Room) => ({
        room: r,
        available: r.status === RoomStatus.AVAILABLE,
      }));
    }

    const dates = this.getDatesBetween(startDate, endDate);
    if (!rooms.length) return [];

    const roomIds = rooms.map((r: Room) => r.id);
    const bookedNights = await this.dataSource.query(
      `SELECT "roomId" FROM "${s}"."room_nights" WHERE date = ANY($1::date[]) AND status IN ('booked', 'held') AND "roomId" = ANY($2)`,
      [dates, roomIds],
    );
    const bookedRoomIds = new Set(bookedNights.map((n: any) => n.roomId));
    return rooms.map((room: Room) => ({
      room,
      available:
        room.status === RoomStatus.AVAILABLE && !bookedRoomIds.has(room.id),
      dates,
    }));
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
