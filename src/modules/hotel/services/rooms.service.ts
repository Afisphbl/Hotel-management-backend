import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Room, RoomStatus } from '../../../database/entities/room.entity';
import { RoomType } from '../../../database/entities/room-type.entity';
import {
  RoomNight,
  RoomNightStatus,
} from '../../../database/entities/room-night.entity';
import { Hotel } from '../../../database/entities/hotel.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
    @InjectRepository(RoomNight)
    private roomNightRepository: Repository<RoomNight>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
  ) {}

  async findAll(
    hotelId: string,
    options: {
      page?: number;
      limit?: number;
      status?: RoomStatus;
      floor?: string;
      roomTypeId?: string;
    },
  ): Promise<PaginatedResult<Room>> {
    const where: any = { hotelId };
    if (options.status) where.status = options.status;
    if (options.floor) where.floor = options.floor;
    if (options.roomTypeId) where.roomTypeId = options.roomTypeId;

    return paginate<Room>(this.roomRepository, {
      page: options.page,
      limit: options.limit,
      where,
      order: { floor: 'ASC', roomNumber: 'ASC' },
      relations: ['roomType'],
    });
  }

  async findById(id: string, hotelId?: string): Promise<Room> {
    const where: any = { id };
    if (hotelId) where.hotelId = hotelId;
    const room = await this.roomRepository.findOne({
      where,
      relations: ['roomType'],
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async create(data: Partial<Room>, hotelId: string): Promise<Room> {
    if (data.roomTypeId) {
      const type = await this.roomTypeRepository.findOneBy({
        id: data.roomTypeId,
      });
      if (!type) throw new NotFoundException('Room type not found');
    }
    const room = await this.roomRepository.save(
      this.roomRepository.create({ ...data, hotelId }),
    );
    await this.syncHotelRoomCount(hotelId);
    return room;
  }

  async update(id: string, data: Partial<Room>, hotelId?: string): Promise<Room> {
    const room = await this.findById(id, hotelId);
    Object.assign(room, data);
    return this.roomRepository.save(room);
  }

  async remove(id: string, hotelId?: string): Promise<void> {
    const room = await this.findById(id, hotelId);
    await this.roomRepository.softRemove(room);
    if (hotelId) await this.syncHotelRoomCount(hotelId);
  }

  async updateStatus(id: string, status: RoomStatus, hotelId?: string): Promise<Room> {
    const room = await this.findById(id, hotelId);
    room.status = status;
    return this.roomRepository.save(room);
  }

  private async syncHotelRoomCount(hotelId: string) {
    const count = await this.roomRepository.count({ where: { hotelId } });
    await this.hotelRepository.update(hotelId, { rooms: count });
  }

  async getSummary(hotelId: string) {
    const counts = await this.roomRepository
      .createQueryBuilder('room')
      .select('room.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('room.hotelId = :hotelId', { hotelId })
      .groupBy('room.status')
      .getRawMany();

    const result: Record<string, number> = {
      total: 0,
      available: 0,
      occupied: 0,
      dirty: 0,
      maintenance: 0,
      out_of_order: 0,
    };

    for (const row of counts) {
      const status = row.status as string;
      result[status] = parseInt(row.count, 10);
      result.total += parseInt(row.count, 10);
    }

    // Resolve plan limits
    const PLAN_LIMITS: Record<string, number> = {
      BASIC: 50,
      PROFESSIONAL: 200,
      ENTERPRISE: 9999,
    };
    let plan = 'BASIC';
    let roomLimit = 50;
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
      // fallback to defaults
    }

    return { ...result, plan, roomLimit };
  }

  async getAvailability(
    hotelId: string,
    roomTypeId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const roomQb = this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .andWhere('room.hotelId = :hotelId', { hotelId });

    if (roomTypeId)
      roomQb.andWhere('room.roomTypeId = :roomTypeId', { roomTypeId });

    const rooms = await roomQb.getMany();

    if (!startDate || !endDate) {
      return rooms.map((r) => ({
        room: r,
        available: r.status === RoomStatus.AVAILABLE,
      }));
    }

    const dates = this.getDatesBetween(startDate, endDate);

    const bookedNights = await this.roomNightRepository
      .createQueryBuilder('rn')
      .where('rn.date IN (:...dates)', { dates })
      .andWhere('rn.status = :status', { status: RoomNightStatus.BOOKED })
      .andWhere('rn.roomId IN (:...roomIds)', {
        roomIds: rooms.map((r) => r.id),
      })
      .getMany();

    const bookedRoomIds = new Set(bookedNights.map((n) => n.roomId));

    return rooms.map((room) => ({
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
