import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';
import { User, UserScope } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../database/entities/global/subscriptions.entity';
import {
  FeatureFlag,
  FeatureFlagStatus,
} from '../../database/entities/global/feature-flag.entity';
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
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(FeatureFlag)
    private featureFlagRepository: Repository<FeatureFlag>,
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

      // 1. Create Hotel Record in Global Schema
      const hotel = this.hotelRepository.create({
        id: hotelId,
        name: data.name,
        subdomain: data.subdomain,
        schemaName: schemaName,
        status: HotelStatus.ACTIVE,
      });

      const savedHotel = await queryRunner.manager.save(hotel);

      // 2. Create the Physical Schema
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // 3. TODO: In a real app, run migrations for the new schema here
      // await queryRunner.query(`SET search_path TO "${schemaName}"`);
      // ... run migrations ...

      await queryRunner.commitTransaction();
      return savedHotel;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        `Failed to create hotel: ${err.message}`,
      );
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
    const userEntity = Array.isArray(saved) ? saved[0] : saved;
    const { password, ...result } = userEntity;
    return result;
  }

  // --- Subscription Management ---

  async findAllSubscriptions() {
    return this.subscriptionRepository.find({ relations: ['hotel'] });
  }

  async findSubscriptionById(id: string) {
    const sub = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['hotel'],
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async createSubscription(data: {
    hotelId: string;
    plan: SubscriptionPlan;
    price: number;
    startDate?: string;
    endDate?: string;
    trialEndDate?: string;
    features?: Record<string, any>;
  }) {
    const subscription = this.subscriptionRepository.create({
      hotel: { id: data.hotelId },
      plan: data.plan,
      price: data.price,
      startDate: data.startDate ? new Date(data.startDate) : new Date(),
      endDate: data.endDate ? new Date(data.endDate) : null,
      trialEndDate: data.trialEndDate ? new Date(data.trialEndDate) : null,
      status: SubscriptionStatus.PENDING,
      features: data.features,
    });
    return this.subscriptionRepository.save(subscription);
  }

  async updateSubscription(
    id: string,
    data: Partial<{
      plan: SubscriptionPlan;
      price: number;
      endDate: string;
      trialEndDate: string;
      features: Record<string, any>;
    }>,
  ) {
    const sub = await this.findSubscriptionById(id);
    if (data.plan) sub.plan = data.plan;
    if (data.price !== undefined) sub.price = data.price;
    if (data.endDate) sub.endDate = new Date(data.endDate);
    if (data.trialEndDate) sub.trialEndDate = new Date(data.trialEndDate);
    if (data.features) sub.features = data.features;
    return this.subscriptionRepository.save(sub);
  }

  async deleteSubscription(id: string) {
    const sub = await this.findSubscriptionById(id);
    await this.subscriptionRepository.delete(id);
    return { success: true };
  }

  async cancelSubscription(id: string) {
    const sub = await this.findSubscriptionById(id);
    sub.status = SubscriptionStatus.CANCELLED;
    sub.endDate = new Date();
    return this.subscriptionRepository.save(sub);
  }

  // --- Feature Flag Management ---

  async findAllFeatureFlags() {
    return this.featureFlagRepository.find({ relations: ['hotel'] });
  }

  async findFeatureFlagById(id: string) {
    const flag = await this.featureFlagRepository.findOne({
      where: { id },
      relations: ['hotel'],
    });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return flag;
  }

  async createFeatureFlag(data: {
    name: string;
    description?: string;
    hotelId?: string;
    status?: FeatureFlagStatus;
    conditions?: Record<string, any>;
  }) {
    const flag = this.featureFlagRepository.create();
    flag.name = data.name;
    if (data.description) flag.description = data.description;
    if (data.hotelId) flag.hotel = { id: data.hotelId } as any;
    flag.status = data.status || FeatureFlagStatus.DISABLED;
    if (data.conditions) flag.conditions = data.conditions;
    return this.featureFlagRepository.save(flag);
    return this.featureFlagRepository.save(flag);
  }

  async updateFeatureFlag(
    id: string,
    data: Partial<{
      description: string;
      status: FeatureFlagStatus;
      conditions: Record<string, any>;
    }>,
  ) {
    const flag = await this.findFeatureFlagById(id);
    if (data.description !== undefined) flag.description = data.description;
    if (data.status) flag.status = data.status;
    if (data.conditions) flag.conditions = data.conditions;
    return this.featureFlagRepository.save(flag);
  }

  async deleteFeatureFlag(id: string) {
    await this.findFeatureFlagById(id);
    await this.featureFlagRepository.delete(id);
    return { success: true };
  }

  async toggleFeatureFlag(id: string) {
    const flag = await this.findFeatureFlagById(id);
    flag.status =
      flag.status === FeatureFlagStatus.ENABLED
        ? FeatureFlagStatus.DISABLED
        : FeatureFlagStatus.ENABLED;
    return this.featureFlagRepository.save(flag);
  }
}
