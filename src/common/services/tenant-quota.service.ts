import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';
import { TenantQuota } from '../../database/entities/global/tenant-quota.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../database/entities/global/subscriptions.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';

export interface TenantQuotaLimits {
  rooms: number;
  users: number;
  storageMb: number;
}

export interface TenantQuotaUsage {
  rooms: number;
  users: number;
  storageMb: number;
}

@Injectable()
export class TenantQuotaService {
  constructor(private readonly dataSource: DataSource) {}

  async getQuotaSnapshot(hotelId: string): Promise<{
    hotel: Hotel;
    subscription: Subscription | null;
    limits: TenantQuotaLimits;
    usage: TenantQuotaUsage;
  }> {
    const hotelRepository = this.dataSource.getRepository(Hotel);
    const subscriptionRepository = this.dataSource.getRepository(Subscription);
    const quotaRepository = this.dataSource.getRepository(TenantQuota);

    const hotel = await hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) {
      throw new ForbiddenException('Hotel not found');
    }

    if (hotel.status !== HotelStatus.ACTIVE) {
      throw new ForbiddenException('Hotel is not active');
    }

    const subscription = await subscriptionRepository.findOne({
      where: { hotel: { id: hotelId }, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    const limits = this.resolveLimits(subscription);
    const usage = await this.getUsage(hotel);

    await this.saveSnapshot(quotaRepository, hotelId, limits, usage);

    return { hotel, subscription, limits, usage };
  }

  async assertRoomCapacity(
    hotelId: string,
    additionalRooms = 1,
  ): Promise<void> {
    const snapshot = await this.getQuotaSnapshot(hotelId);
    if (snapshot.usage.rooms + additionalRooms > snapshot.limits.rooms) {
      throw new ForbiddenException(
        `Plan limit reached. Your current plan allows only ${snapshot.limits.rooms} rooms.`,
      );
    }
  }

  async assertUserCapacity(hotelId: string, additionalUsers = 1): Promise<void> {
    const snapshot = await this.getQuotaSnapshot(hotelId);
    if (snapshot.usage.users + additionalUsers > snapshot.limits.users) {
      throw new ForbiddenException(
        `Plan limit reached. Your current plan allows only ${snapshot.limits.users} users.`,
      );
    }
  }

  async assertStorageCapacity(
    hotelId: string,
    additionalMb: number,
  ): Promise<void> {
    if (!Number.isFinite(additionalMb) || additionalMb <= 0) {
      throw new BadRequestException('Storage allocation must be greater than zero');
    }

    const snapshot = await this.getQuotaSnapshot(hotelId);
    if (snapshot.usage.storageMb + additionalMb > snapshot.limits.storageMb) {
      throw new ForbiddenException(
        `Plan limit reached. Your current plan allows only ${snapshot.limits.storageMb} MB storage.`,
      );
    }
  }

  async reserveStorage(
    hotelId: string,
    additionalMb: number,
  ): Promise<Hotel> {
    await this.assertStorageCapacity(hotelId, additionalMb);

    const hotelRepository = this.dataSource.getRepository(Hotel);
    const quotaRepository = this.dataSource.getRepository(TenantQuota);
    const hotel = await hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) {
      throw new ForbiddenException('Hotel not found');
    }

    hotel.storageUsedMb = (hotel.storageUsedMb || 0) + additionalMb;
    const savedHotel = await hotelRepository.save(hotel);
    await this.syncStorageUsage(quotaRepository, savedHotel);
    return savedHotel;
  }

  async syncQuotaSnapshot(hotelId: string): Promise<TenantQuota> {
    const hotelRepository = this.dataSource.getRepository(Hotel);
    const quotaRepository = this.dataSource.getRepository(TenantQuota);
    const subscriptionRepository = this.dataSource.getRepository(Subscription);

    const hotel = await hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) {
      throw new ForbiddenException('Hotel not found');
    }

    const subscription = await subscriptionRepository.findOne({
      where: { hotel: { id: hotelId }, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    const limits = this.resolveLimits(subscription);
    const usage = await this.getUsage(hotel);
    return this.saveSnapshot(quotaRepository, hotelId, limits, usage);
  }

  async incrementRoomUsage(hotelId: string): Promise<TenantQuota> {
    return this.syncQuotaSnapshot(hotelId);
  }

  async decrementRoomUsage(hotelId: string): Promise<TenantQuota> {
    return this.syncQuotaSnapshot(hotelId);
  }

  async incrementUserUsage(hotelId: string): Promise<TenantQuota> {
    return this.syncQuotaSnapshot(hotelId);
  }

  async decrementUserUsage(hotelId: string): Promise<TenantQuota> {
    return this.syncQuotaSnapshot(hotelId);
  }

  private resolveLimits(subscription: Subscription | null): TenantQuotaLimits {
    const plan = subscription?.plan ?? SubscriptionPlan.BASIC;
    const customLimits = (subscription?.features?.limits || {}) as Partial<
      TenantQuotaLimits
    >;

    const defaults: Record<SubscriptionPlan, TenantQuotaLimits> = {
      [SubscriptionPlan.BASIC]: { rooms: 50, users: 10, storageMb: 1024 },
      [SubscriptionPlan.PROFESSIONAL]: {
        rooms: 200,
        users: 50,
        storageMb: 5120,
      },
      [SubscriptionPlan.ENTERPRISE]: {
        rooms: 9999,
        users: 500,
        storageMb: 51200,
      },
    };

    return {
      rooms: customLimits.rooms ?? defaults[plan].rooms,
      users: customLimits.users ?? defaults[plan].users,
      storageMb: customLimits.storageMb ?? defaults[plan].storageMb,
    };
  }

  private async getUsage(hotel: Hotel): Promise<TenantQuotaUsage> {
    const schemaName = this.assertSafeSchemaName(hotel.schemaName);
    let roomCount = 0;
    let accessCount = 0;
    let staffCount = 0;

    try {
      const roomCountResult = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${schemaName}"."rooms"`,
      );
      roomCount = Number(roomCountResult?.[0]?.count ?? 0);
    } catch {
      roomCount = 0;
    }

    try {
      accessCount = await this.dataSource
        .getRepository(HotelUserAccess)
        .count({ where: { hotelId: hotel.id } });
    } catch {
      accessCount = 0;
    }

    try {
      const staffCountResult = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${schemaName}"."staff"`,
      );
      staffCount = Number(staffCountResult?.[0]?.count ?? 0);
    } catch {
      staffCount = 0;
    }

    return {
      rooms: roomCount,
      users: Number(accessCount ?? 0) + Number(staffCount ?? 0),
      storageMb: Number(hotel.storageUsedMb ?? 0),
    };
  }

  private async saveSnapshot(
    quotaRepository: Repository<TenantQuota>,
    hotelId: string,
    limits: TenantQuotaLimits,
    usage: TenantQuotaUsage,
  ): Promise<TenantQuota> {
    let quota = await quotaRepository.findOne({ where: { hotelId } });
    if (!quota) {
      quota = quotaRepository.create({ hotelId });
    }

    quota.maxUsers = limits.users;
    quota.maxRooms = limits.rooms;
    quota.maxStorageMb = limits.storageMb;
    quota.currentUsers = usage.users;
    quota.currentRooms = usage.rooms;
    quota.currentStorageMb = usage.storageMb;

    return quotaRepository.save(quota);
  }

  private async syncStorageUsage(
    quotaRepository: Repository<TenantQuota>,
    hotel: Hotel,
  ): Promise<void> {
    const quota = await quotaRepository.findOne({ where: { hotelId: hotel.id } });
    if (!quota) {
      return;
    }

    quota.currentStorageMb = Number(hotel.storageUsedMb ?? 0);
    await quotaRepository.save(quota);
  }

  private assertSafeSchemaName(schemaName: string): string {
    if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
      throw new ForbiddenException('Invalid tenant schema');
    }

    return schemaName;
  }
}
