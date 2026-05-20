import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from '../../../database/entities/room.entity';
import { RoomType } from '../../../database/entities/room-type.entity';
import {
  RoomNight,
  RoomNightStatus,
} from '../../../database/entities/room-night.entity';
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
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: RoomStatus;
    floor?: string;
    roomTypeId?: string;
  }): Promise<PaginatedResult<Room>> {
    const where: any = {};
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

  async findById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['roomType'],
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async create(data: Partial<Room>): Promise<Room> {
    if (data.roomTypeId) {
      const type = await this.roomTypeRepository.findOneBy({
        id: data.roomTypeId,
      });
      if (!type) throw new NotFoundException('Room type not found');
    }
    const room = await this.roomRepository.save(
      this.roomRepository.create(data),
    );
    return room;
  }

  async update(id: string, data: Partial<Room>): Promise<Room> {
    const room = await this.findById(id);
    Object.assign(room, data);
    return this.roomRepository.save(room);
  }

  async remove(id: string): Promise<void> {
    const room = await this.findById(id);
    await this.roomRepository.softRemove(room);
  }

  async updateStatus(id: string, status: RoomStatus): Promise<Room> {
    const room = await this.findById(id);
    room.status = status;
    return this.roomRepository.save(room);
  }

  async getAvailability(
    roomTypeId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const roomQb = this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType');

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
