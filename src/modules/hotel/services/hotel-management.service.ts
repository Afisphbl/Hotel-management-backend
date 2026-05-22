import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel, HotelStatus } from '../../../database/entities/hotel.entity';

@Injectable()
export class HotelManagementService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
  ) {}

  async findByOwner(ownerEmail: string) {
    if (!ownerEmail) return [];
    return this.hotelRepository.find({ where: { ownerEmail } });
  }

  async create(data: any) {
    const entity = this.hotelRepository.create({
      name: data.name,
      slug: data.slug || (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      location: data.location,
      timezone: data.timezone,
      currency: data.currency,
      ownerEmail: data.ownerEmail,
      ownerName: data.ownerName,
          status: HotelStatus.ACTIVE,
      branding: data.branding || null,
        } as any);
    return this.hotelRepository.save(entity);
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
