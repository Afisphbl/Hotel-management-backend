import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';
import { User, UserScope } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PlatformService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
  ) {}

  // --- Hotel Management ---

  async findAllHotels() {
    return this.hotelRepository.find();
  }

  async findHotelById(id: string) {
    return this.hotelRepository.findOne({ where: { id } });
  }

  async createHotel(data: { name: string; subdomain?: string }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hotelId = crypto.randomUUID();
      const schemaName = `hotel_${hotelId.replace(/-/g, '_')}`;

      // 1. Create Hotel Record in Public Schema
      const hotel = this.hotelRepository.create({
        id: hotelId,
        name: data.name,
        subdomain: data.subdomain,
        schemaName: schemaName,
        status: HotelStatus.ACTIVE,
      });
      
      const savedHotel = await queryRunner.manager.save(hotel);

      // 2. Create the Physical Schema
      await queryRunner.query(`CREATE SCHEMA "${schemaName}"`);

      // 3. TODO: In a real app, run migrations for the new schema here
      // await queryRunner.query(`SET search_path TO "${schemaName}"`);
      // ... run migrations ...

      await queryRunner.commitTransaction();
      return savedHotel;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(`Failed to create hotel: ${err.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async updateHotel(id: string, data: Partial<Hotel>) {
    await this.hotelRepository.update(id, data);
    return this.findHotelById(id);
  }

  async deleteHotel(id: string) {
    const hotel = await this.findHotelById(id);
    if (hotel) {
      // Note: We usually don't delete schemas for audit reasons, 
      // but we could drop it if needed.
      await this.hotelRepository.delete(id);
      return { success: true };
    }
    return { success: false };
  }

  // --- Analytics ---

  async getGlobalAnalytics() {
    const totalHotels = await this.hotelRepository.count();
    const totalUsers = await this.userRepository.count();
    const totalPlatformAdmins = await this.userRepository.count({
      where: { scope: UserScope.PLATFORM },
    });

    return {
      totalHotels,
      totalUsers,
      totalPlatformAdmins,
      timestamp: new Date(),
    };
  }

  // --- Staff Management (Platform Scope) ---

  async findAllPlatformStaff() {
    return this.userRepository.find({
      where: { scope: UserScope.PLATFORM },
      select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'createdAt'],
    });
  }

  async createPlatformStaff(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.userRepository.create({
      ...data,
      password: hashedPassword,
      scope: UserScope.PLATFORM,
      isActive: true,
    });
    const saved = await this.userRepository.save(user);
    // Handle both single and array returns from TypeORM save
    const userEntity = Array.isArray(saved) ? saved[0] : saved;
    const { password, ...result } = userEntity;
    return result;
  }
}
