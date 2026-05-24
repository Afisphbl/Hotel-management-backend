import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { assertSafeSchemaName } from '../tenant/tenant-utils';
import { DataSource, Repository, MoreThan } from 'typeorm';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';
import { TenantQuota } from '../../database/entities/global/tenant-quota.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../database/entities/global/subscriptions.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { OverageBilling, OverageType, OverageStatus } from '../../database/entities/global/overage-billing.entity';
import { QuotaAlert, QuotaAlertSeverity, QuotaAlertStatus } from '../../database/entities/global/quota-alert.entity';

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

export interface OverageRate {
  rooms: number;
  users: number;
  storageMb: number;
}

const DEFAULT_OVERAGE_RATES: OverageRate = {
  rooms: 10,
  users: 15,
  storageMb: 2,
};

const OVERAGE_ALERT_THRESHOLDS = [80, 90, 95, 100];

@Injectable()
export class TenantQuotaService {
  private readonly logger = new Logger(TenantQuotaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getQuotaSnapshot(hotelId: string): Promise<{
    hotel: Hotel;
    subscription: Subscription | null;
    limits: TenantQuotaLimits;
    usage: TenantQuotaUsage;
    overage: { rooms: number; users: number; storageMb: number };
    overageAmount: number;
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
    const overage = this.calculateOverage(usage, limits);
    const overageRates = this.getOverageRates(subscription);
    const overageAmount = this.calculateOverageCost(overage, overageRates);

    const quota = await this.saveSnapshot(quotaRepository, hotelId, limits, usage, overageAmount);

    await this.checkAndCreateAlerts(hotelId, limits, usage);

    return { hotel, subscription, limits, usage, overage, overageAmount };
  }

  async assertRoomCapacity(
    hotelId: string,
    additionalRooms = 1,
  ): Promise<{ allowed: boolean; overage: boolean; overageCost: number }> {
    const snapshot = await this.getQuotaSnapshot(hotelId);
    const total = snapshot.usage.rooms + additionalRooms;

    if (total <= snapshot.limits.rooms) {
      return { allowed: true, overage: false, overageCost: 0 };
    }

    if (snapshot.subscription?.plan === SubscriptionPlan.ENTERPRISE) {
      const overageUnits = total - snapshot.limits.rooms;
      const overageRates = this.getOverageRates(snapshot.subscription);
      const overageCost = overageUnits * overageRates.rooms;
      await this.recordOverage(snapshot.hotel.id, OverageType.ROOMS, overageUnits, overageRates.rooms, overageCost);
      return { allowed: true, overage: true, overageCost };
    }

    throw new ForbiddenException(
      `Plan limit reached. Your current plan allows only ${snapshot.limits.rooms} rooms. Upgrade to Enterprise for overage support.`,
    );
  }

  async assertUserCapacity(hotelId: string, additionalUsers = 1): Promise<{ allowed: boolean; overage: boolean; overageCost: number }> {
    const snapshot = await this.getQuotaSnapshot(hotelId);
    const total = snapshot.usage.users + additionalUsers;

    if (total <= snapshot.limits.users) {
      return { allowed: true, overage: false, overageCost: 0 };
    }

    if (snapshot.subscription?.plan === SubscriptionPlan.ENTERPRISE) {
      const overageUnits = total - snapshot.limits.users;
      const overageRates = this.getOverageRates(snapshot.subscription);
      const overageCost = overageUnits * overageRates.users;
      await this.recordOverage(snapshot.hotel.id, OverageType.USERS, overageUnits, overageRates.users, overageCost);
      return { allowed: true, overage: true, overageCost };
    }

    throw new ForbiddenException(
      `Plan limit reached. Your current plan allows only ${snapshot.limits.users} users. Upgrade to Enterprise for overage support.`,
    );
  }

  async assertStorageCapacity(
    hotelId: string,
    additionalMb: number,
  ): Promise<{ allowed: boolean; overage: boolean; overageCost: number }> {
    if (!Number.isFinite(additionalMb) || additionalMb <= 0) {
      throw new BadRequestException('Storage allocation must be greater than zero');
    }

    const snapshot = await this.getQuotaSnapshot(hotelId);
    const total = snapshot.usage.storageMb + additionalMb;

    if (total <= snapshot.limits.storageMb) {
      return { allowed: true, overage: false, overageCost: 0 };
    }

    if (snapshot.subscription?.plan === SubscriptionPlan.ENTERPRISE) {
      const overageUnits = total - snapshot.limits.storageMb;
      const overageRates = this.getOverageRates(snapshot.subscription);
      const overageCost = overageUnits * overageRates.storageMb;
      await this.recordOverage(snapshot.hotel.id, OverageType.STORAGE, overageUnits, overageRates.storageMb, overageCost);
      return { allowed: true, overage: true, overageCost };
    }

    throw new ForbiddenException(
      `Plan limit reached. Your current plan allows only ${snapshot.limits.storageMb} MB storage. Upgrade to Enterprise for overage support.`,
    );
  }

  async reserveStorage(
    hotelId: string,
    additionalMb: number,
  ): Promise<Hotel> {
    const result = await this.assertStorageCapacity(hotelId, additionalMb);

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
    const overageAmount = this.calculateOverageCost(
      this.calculateOverage(usage, limits),
      this.getOverageRates(subscription),
    );
    return this.saveSnapshot(quotaRepository, hotelId, limits, usage, overageAmount);
  }

  async incrementRoomUsage(hotelId: string): Promise<TenantQuota> {
    const quota = await this.syncQuotaSnapshot(hotelId);
    const repo = this.dataSource.getRepository(TenantQuota);
    if (quota.currentRooms > quota.peakRooms) {
      quota.peakRooms = quota.currentRooms;
      await repo.save(quota);
    }
    return quota;
  }

  async decrementRoomUsage(hotelId: string): Promise<TenantQuota> {
    return this.syncQuotaSnapshot(hotelId);
  }

  async incrementUserUsage(hotelId: string): Promise<TenantQuota> {
    const quota = await this.syncQuotaSnapshot(hotelId);
    const repo = this.dataSource.getRepository(TenantQuota);
    if (quota.currentUsers > quota.peakUsers) {
      quota.peakUsers = quota.currentUsers;
      await repo.save(quota);
    }
    return quota;
  }

  async decrementUserUsage(hotelId: string): Promise<TenantQuota> {
    return this.syncQuotaSnapshot(hotelId);
  }

  async getOverageBilling(hotelId: string): Promise<OverageBilling[]> {
    return this.dataSource.getRepository(OverageBilling).find({
      where: { hotelId },
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingOverageTotal(): Promise<number> {
    const result = await this.dataSource.getRepository(OverageBilling)
      .createQueryBuilder('ob')
      .select('COALESCE(SUM(ob.totalAmount), 0)', 'total')
      .where('ob.status = :status', { status: OverageStatus.PENDING })
      .getRawOne();
    return Number(result?.total || 0);
  }

  async getAlerts(hotelId?: string): Promise<QuotaAlert[]> {
    const where: any = { status: QuotaAlertStatus.ACTIVE };
    if (hotelId) where.hotelId = hotelId;
    return this.dataSource.getRepository(QuotaAlert).find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async dismissAlert(alertId: string): Promise<void> {
    await this.dataSource.getRepository(QuotaAlert).update(alertId, {
      status: QuotaAlertStatus.DISMISSED,
    });
  }

  async getQuotaUtilization(hotelId: string) {
    const snapshot = await this.getQuotaSnapshot(hotelId);
    return {
      rooms: {
        used: snapshot.usage.rooms,
        limit: snapshot.limits.rooms,
        utilizationPct: snapshot.limits.rooms > 0
          ? Math.round((snapshot.usage.rooms / snapshot.limits.rooms) * 100)
          : 0,
        overage: snapshot.overage.rooms,
      },
      users: {
        used: snapshot.usage.users,
        limit: snapshot.limits.users,
        utilizationPct: snapshot.limits.users > 0
          ? Math.round((snapshot.usage.users / snapshot.limits.users) * 100)
          : 0,
        overage: snapshot.overage.users,
      },
      storage: {
        used: snapshot.usage.storageMb,
        limit: snapshot.limits.storageMb,
        utilizationPct: snapshot.limits.storageMb > 0
          ? Math.round((snapshot.usage.storageMb / snapshot.limits.storageMb) * 100)
          : 0,
        overage: snapshot.overage.storageMb,
      },
      overageAmount: snapshot.overageAmount,
    };
  }

  async billOverage(hotelId: string): Promise<OverageBilling[]> {
    const snapshot = await this.getQuotaSnapshot(hotelId);
    const billings: OverageBilling[] = [];
    const repo = this.dataSource.getRepository(OverageBilling);

    const overageRates = this.getOverageRates(snapshot.subscription);

    if (snapshot.overage.rooms > 0) {
      const billing = repo.create({
        hotelId,
        overageType: OverageType.ROOMS,
        overageUnits: snapshot.overage.rooms,
        unitPrice: overageRates.rooms,
        totalAmount: snapshot.overage.rooms * overageRates.rooms,
        billingPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        billingPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        status: OverageStatus.BILLED,
        description: `Overage for ${snapshot.overage.rooms} additional rooms`,
      });
      billings.push(await repo.save(billing));
    }

    if (snapshot.overage.users > 0) {
      const billing = repo.create({
        hotelId,
        overageType: OverageType.USERS,
        overageUnits: snapshot.overage.users,
        unitPrice: overageRates.users,
        totalAmount: snapshot.overage.users * overageRates.users,
        billingPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        billingPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        status: OverageStatus.BILLED,
        description: `Overage for ${snapshot.overage.users} additional users`,
      });
      billings.push(await repo.save(billing));
    }

    if (snapshot.overage.storageMb > 0) {
      const billing = repo.create({
        hotelId,
        overageType: OverageType.STORAGE,
        overageUnits: snapshot.overage.storageMb,
        unitPrice: overageRates.storageMb,
        totalAmount: snapshot.overage.storageMb * overageRates.storageMb,
        billingPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        billingPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
        status: OverageStatus.BILLED,
        description: `Overage for ${snapshot.overage.storageMb} MB additional storage`,
      });
      billings.push(await repo.save(billing));
    }

    const quota = await this.dataSource.getRepository(TenantQuota).findOne({ where: { hotelId } });
    if (quota) {
      quota.overageAmount = snapshot.overageAmount;
      quota.lastOverageBilledAt = new Date();
      await this.dataSource.getRepository(TenantQuota).save(quota);
    }

    return billings;
  }

  private calculateOverage(usage: TenantQuotaUsage, limits: TenantQuotaLimits): { rooms: number; users: number; storageMb: number } {
    return {
      rooms: Math.max(0, usage.rooms - limits.rooms),
      users: Math.max(0, usage.users - limits.users),
      storageMb: Math.max(0, usage.storageMb - limits.storageMb),
    };
  }

  private getOverageRates(subscription: Subscription | null): OverageRate {
    if (subscription?.overagePricing) {
      return {
        rooms: Number(subscription.overagePricing['rooms']) || DEFAULT_OVERAGE_RATES.rooms,
        users: Number(subscription.overagePricing['users']) || DEFAULT_OVERAGE_RATES.users,
        storageMb: Number(subscription.overagePricing['storageMb']) || DEFAULT_OVERAGE_RATES.storageMb,
      };
    }
    return { ...DEFAULT_OVERAGE_RATES };
  }

  private calculateOverageCost(overage: { rooms: number; users: number; storageMb: number }, rates: OverageRate): number {
    return (overage.rooms * rates.rooms) + (overage.users * rates.users) + (overage.storageMb * rates.storageMb);
  }

  private async recordOverage(hotelId: string, type: OverageType, units: number, unitPrice: number, totalAmount: number): Promise<OverageBilling> {
    const repo = this.dataSource.getRepository(OverageBilling);
    const billing = repo.create({
      hotelId,
      overageType: type,
      overageUnits: units,
      unitPrice,
      totalAmount,
      billingPeriodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      billingPeriodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      status: OverageStatus.PENDING,
      description: `Auto-recorded overage: ${units} ${type}`,
    });
    return repo.save(billing);
  }

  private async checkAndCreateAlerts(hotelId: string, limits: TenantQuotaLimits, usage: TenantQuotaUsage): Promise<void> {
    const alertRepo = this.dataSource.getRepository(QuotaAlert);
    const resources = [
      { type: 'rooms', current: usage.rooms, limit: limits.rooms },
      { type: 'users', current: usage.users, limit: limits.users },
      { type: 'storage', current: usage.storageMb, limit: limits.storageMb },
    ];

    for (const resource of resources) {
      if (resource.limit <= 0) continue;
      const pct = Math.round((resource.current / resource.limit) * 100);

      for (const threshold of OVERAGE_ALERT_THRESHOLDS) {
        if (pct >= threshold) {
          if (pct >= 100) {
            this.logger.warn(`Hotel ${hotelId} has exceeded ${resource.type} limit: ${resource.current}/${resource.limit}`);
          }
          const existing = await alertRepo.findOne({
            where: {
              hotelId,
              resourceType: resource.type,
              thresholdPercent: threshold,
              status: QuotaAlertStatus.ACTIVE,
            },
          });
          if (!existing) {
            const severity = pct >= 100 ? QuotaAlertSeverity.CRITICAL : pct >= 90 ? QuotaAlertSeverity.WARNING : QuotaAlertSeverity.INFO;
            await alertRepo.save(alertRepo.create({
              hotelId,
              resourceType: resource.type,
              currentUsage: resource.current,
              limitValue: resource.limit,
              thresholdPercent: threshold,
              severity,
              message: `${resource.type} usage at ${pct}% (${resource.current}/${resource.limit})`,
            }));
          }
          break;
        }
      }
    }
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
    const schemaName = assertSafeSchemaName(hotel.schemaName);
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
    overageAmount?: number,
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
    quota.quotaCheckinAt = new Date();

    if (overageAmount !== undefined) {
      quota.overageAmount = overageAmount;
    }

    if (usage.rooms > quota.peakRooms) quota.peakRooms = usage.rooms;
    if (usage.users > quota.peakUsers) quota.peakUsers = usage.users;
    if (usage.storageMb > quota.peakStorageMb) quota.peakStorageMb = usage.storageMb;

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
}
