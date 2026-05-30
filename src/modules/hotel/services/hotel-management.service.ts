import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel, HotelStatus } from '../../../database/entities/hotel.entity';
import { Room, RoomStatus } from '../../../database/entities/room.entity';

@Injectable()
export class HotelManagementService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
  ) {}

  async findByOwner(ownerEmail: string) {
    if (!ownerEmail) return [];
    return this.hotelRepository.find({ where: { ownerEmail } });
  }

  async findOne(id: string) {
    return this.hotelRepository.findOne({ where: { id } });
  }

  async create(data: any) {
    const hotel = new Hotel();
    hotel.name = data.name;
    hotel.slug =
      data.slug || (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    hotel.location = data.location;
    hotel.timezone = data.timezone;
    hotel.currency = data.currency;
    hotel.ownerEmail = data.ownerEmail;
    hotel.ownerName = data.ownerName;
    hotel.status = HotelStatus.ACTIVE;
    hotel.rooms = data.rooms || 0;
    hotel.branding = data.branding || null;
    await this.hotelRepository.save(hotel);

    if (data.rooms && data.rooms > 0) {
      // Fetch any rooms already seeded for this hotel to avoid duplicates
      const existing = await this.roomRepository.find({
        where: { hotelId: hotel.id },
      });
      const existingNumbers = new Set(existing.map((r) => r.roomNumber));

      const rooms: Partial<Room>[] = [];
      for (let i = 1; i <= data.rooms; i++) {
        const num = String(i);
        if (!existingNumbers.has(num)) {
          rooms.push({
            roomNumber: num,
            floor: 'Ground',
            hotelId: hotel.id,
            status: RoomStatus.AVAILABLE,
          });
        }
      }
      if (rooms.length > 0) {
        await this.roomRepository.save(this.roomRepository.create(rooms));
      }
    }

    return hotel;
  }

  async update(id: string, data: any) {
    const hotel = await this.hotelRepository.findOne({ where: { id } });
    if (!hotel) return null;
    Object.assign(hotel, data);
    return this.hotelRepository.save(hotel);
  }

  async setActive(id: string, active: boolean) {
    const hotel = await this.hotelRepository.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.status = active ? HotelStatus.ACTIVE : HotelStatus.INACTIVE;
    return this.hotelRepository.save(hotel);
  }

  async updateBranding(id: string, branding: any) {
    const hotel = await this.hotelRepository.findOne({ where: { id } });
    if (!hotel) return null;
    hotel.branding = branding;
    return this.hotelRepository.save(hotel);
  }
}
