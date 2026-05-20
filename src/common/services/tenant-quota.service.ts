import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';
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
    const hotel = await hotelRepository.findOne({ where: { id: hotelId } });
    if (!hotel) {
      throw new ForbiddenException('Hotel not found');
    }

    hotel.storageUsedMb = (hotel.storageUsedMb || 0) + additionalMb;
    return hotelRepository.save(hotel);
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
    const roomCountResult = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${hotel.schemaName}"."rooms"`,
    );
    const accessCount = await this.dataSource
      .getRepository(HotelUserAccess)
      .count({ where: { hotelId: hotel.id } });
    const staffCountResult = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${hotel.schemaName}"."staff"`,
    );

    return {
      rooms: Number(roomCountResult?.[0]?.count ?? 0),
      users:
        Number(accessCount ?? 0) + Number(staffCountResult?.[0]?.count ?? 0),
      storageMb: Number(hotel.storageUsedMb ?? 0),
    };
  }
}
