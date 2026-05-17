import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel } from '../../database/entities/hotel.entity';
import { User, UserScope } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';

@Injectable()
export class PlatformService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  // Hotel CRUD
  async findAllHotels() {
    return this.hotelRepository.find();
  }

  async createHotel(data: Partial<Hotel>) {
    const hotel = this.hotelRepository.create(data);
    return this.hotelRepository.save(hotel);
  }

  // Analytics
  async getGlobalAnalytics() {
    const totalHotels = await this.hotelRepository.count();
    const totalUsers = await this.userRepository.count();
    const totalPlatformAdmins = await this.userRepository.count({
      where: { scope: UserScope.PLATFORM },
    });

    // Note: Bookings are in tenant schemas. 
    // To get global analytics, we would typically query a central analytics table 
    // or aggregate from all schemas (which is expensive).
    // For now, we return data from the public schema.
    
    return {
      totalHotels,
      totalUsers,
      totalPlatformAdmins,
      timestamp: new Date(),
    };
  }

  // Staff Management (Platform Scope)
  async findAllPlatformStaff() {
    return this.userRepository.find({
      where: { scope: UserScope.PLATFORM },
      select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'createdAt'],
    });
  }
}
