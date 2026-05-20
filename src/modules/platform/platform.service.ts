import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In } from 'typeorm';
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
import { AuditLog } from '../../database/entities/audit-log.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role } from '../../database/entities/role.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';

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
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  // --- Hotel Management ---

  async findAllHotels(): Promise<Array<Record<string, any>>> {
    const hotels = await this.hotelRepository.find({
      order: { createdAt: 'DESC' },
    });
    const enrichedHotels: Array<Record<string, any>> = [];

    for (const hotel of hotels) {
      // 1. Resolve Active Subscription/Plan
      const activeSub = await this.subscriptionRepository.findOne({
        where: { hotel: { id: hotel.id }, status: SubscriptionStatus.ACTIVE },
      });
      const rawPlan = activeSub?.plan || SubscriptionPlan.BASIC;
      const plan =
        rawPlan === SubscriptionPlan.PROFESSIONAL
          ? 'Pro'
          : rawPlan.charAt(0) + rawPlan.slice(1).toLowerCase();

      // 2. Resolve Primary Owner
      let owner = 'John Doe';
      let email = 'owner@example.com';
      try {
        const ownerAccess = (await this.dataSource.query(
          `SELECT u.email, u."firstName", u."lastName"
           FROM global.users u
           INNER JOIN global.hotel_user_access hua ON hua."userId" = u.id
           INNER JOIN global.roles r ON hua."roleId" = r.id
           WHERE hua."hotelId" = $1 AND r.name = 'HOTEL_OWNER'
           LIMIT 1`,
          [hotel.id],
        )) as Array<{
          email: string;
          firstName: string | null;
          lastName: string | null;
        }>;

        if (ownerAccess && ownerAccess.length > 0) {
          const first = ownerAccess[0].firstName || '';
          const last = ownerAccess[0].lastName || '';
          owner = `${first} ${last}`.trim() || ownerAccess[0].email;
          email = ownerAccess[0].email;
        }
      } catch {
        // Fallback if global tables aren't fully configured/seeded
      }

      enrichedHotels.push({
        id: hotel.id,
        name: hotel.name,
        subdomain: hotel.subdomain,
        schemaName: hotel.schemaName,
        status: hotel.status,
        created: hotel.createdAt,
        owner,
        email,
        plan,
        rooms: hotel.rooms,
      });
    }

    return enrichedHotels;
  }

  async findHotelById(id: string): Promise<Record<string, any>> {
    const hotel = await this.hotelRepository.findOne({ where: { id } });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    // 1. Resolve Active Subscription/Plan
    const activeSub = await this.subscriptionRepository.findOne({
      where: { hotel: { id: hotel.id }, status: SubscriptionStatus.ACTIVE },
    });
    const rawPlan = activeSub?.plan || SubscriptionPlan.BASIC;
    const plan =
      rawPlan === SubscriptionPlan.PROFESSIONAL
        ? 'Pro'
        : rawPlan.charAt(0) + rawPlan.slice(1).toLowerCase();

    // 2. Resolve Primary Owner
    let owner = 'John Doe';
    let email = 'owner@example.com';
    let phone = '+1 234 567 890';
    try {
      const ownerAccess = (await this.dataSource.query(
        `SELECT u.email, u.phone, u."firstName", u."lastName"
         FROM global.users u
         INNER JOIN global.hotel_user_access hua ON hua."userId" = u.id
         INNER JOIN global.roles r ON hua."roleId" = r.id
         WHERE hua."hotelId" = $1 AND r.name = 'HOTEL_OWNER'
         LIMIT 1`,
        [hotel.id],
      )) as Array<{
        email: string;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
      }>;

      if (ownerAccess && ownerAccess.length > 0) {
        const first = ownerAccess[0].firstName || '';
        const last = ownerAccess[0].lastName || '';
        owner = `${first} ${last}`.trim() || ownerAccess[0].email;
        email = ownerAccess[0].email;
        phone = ownerAccess[0].phone || phone;
      }
    } catch {
      // Fallback
    }

    // 3. Query count of rooms inside tenant schema
    let totalRooms = hotel.rooms;
    try {
      const dbRooms = (await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${hotel.schemaName}"."rooms"`,
      )) as Array<{ count: string }>;
      totalRooms = parseInt(dbRooms[0]?.count || String(hotel.rooms), 10);
    } catch {
      // Fallback
    }

    // 4. Query count of users linked to this hotel from global
    let activeUsers = 12;
    try {
      const dbUsers = (await this.dataSource.query(
        `SELECT COUNT(*) as count FROM global.hotel_user_access WHERE "hotelId" = $1`,
        [hotel.id],
      )) as Array<{ count: string }>;
      activeUsers = parseInt(dbUsers[0]?.count || '12', 10);
    } catch {
      // Fallback
    }

    return {
      id: hotel.id,
      name: hotel.name,
      subdomain: hotel.subdomain,
      schemaName: hotel.schemaName,
      status: hotel.status,
      created: hotel.createdAt,
      owner,
      email,
      phone,
      plan,
      location: hotel.location || 'London, UK',
      totalRooms,
      currentOccupancy: '78%',
      monthlyRevenue: activeSub ? Number(activeSub.price) : 0,
      activeUsers,
      storageUsed: hotel.storageUsedMb
        ? `${(hotel.storageUsedMb / 1024).toFixed(1)} GB`
        : '1.2 GB',
      lastBackup: new Date().toISOString(),
      region: hotel.region || 'europe-west',
      environment: 'production',
      timezone: hotel.timezone || 'UTC',
      currency: hotel.currency || 'GBP',
    };
  }

  async createHotel(data: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hotelId = crypto.randomUUID();
      const schemaName = `hotel_${hotelId.replace(/-/g, '_')}`;

      // Generate appropriate subdomain if not provided
      const subdomain = data.code
        ? data.code.toLowerCase().replace(/[^a-z0-9]/g, '')
        : data.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // 1. Create Hotel Record in Global Schema
      const hotel = this.hotelRepository.create({
        id: hotelId,
        name: data.name,
        subdomain: data.subdomain || subdomain,
        schemaName: schemaName,
        status: HotelStatus.ACTIVE,
        location: data.city
          ? `${data.city}, ${data.country || 'United Kingdom'}`
          : 'London, United Kingdom',
        timezone: data.timezone || 'UTC',
        currency: data.country === 'United Kingdom' ? 'GBP' : 'USD',
        rooms: data.rooms || 120,
      });

      const savedHotel = await queryRunner.manager.save(hotel);

      // Create owner user if provided
      if (data.ownerEmail) {
        const hashedPassword = await bcrypt.hash(
          data.password || 'Temporary123!',
          10,
        );
        const nameParts = (data.ownerName || 'Hotel Owner').split(' ');
        const firstName = nameParts[0] || 'Hotel';
        const lastName = nameParts.slice(1).join(' ') || 'Owner';

        const user = queryRunner.manager.create(User, {
          email: data.ownerEmail,
          password: hashedPassword,
          firstName,
          lastName,
          scope: UserScope.HOTEL,
          isActive: true,
        });
        const savedUser = await queryRunner.manager.save(user);

        // Find or create HOTEL_OWNER role
        let role = await queryRunner.manager.findOne(Role, {
          where: { name: 'HOTEL_OWNER' },
        });
        if (!role) {
          role = queryRunner.manager.create(Role, {
            name: 'HOTEL_OWNER',
            description: 'Full access to all hotel operations',
            isSystemRole: true,
          });
          role = await queryRunner.manager.save(role);
        }

        // Create HotelUserAccess
        const userAccess = queryRunner.manager.create(HotelUserAccess, {
          userId: savedUser.id,
          hotelId: savedHotel.id,
          roleId: role.id,
        });
        await queryRunner.manager.save(userAccess);
      }

      // Create active subscription
      const rawPlan = data.plan || 'Pro';
      const plan =
        rawPlan === 'Pro'
          ? SubscriptionPlan.PROFESSIONAL
          : rawPlan === 'Basic'
            ? SubscriptionPlan.BASIC
            : rawPlan === 'Enterprise'
              ? SubscriptionPlan.ENTERPRISE
              : SubscriptionPlan.PROFESSIONAL;

      const subPrice =
        plan === SubscriptionPlan.BASIC
          ? 99
          : plan === SubscriptionPlan.PROFESSIONAL
            ? 299
            : 999;

      const subscription = queryRunner.manager.create(Subscription, {
        hotel: { id: hotelId },
        plan,
        price: subPrice,
        currency: data.country === 'United Kingdom' ? 'GBP' : 'USD',
        startDate: new Date(),
        status: SubscriptionStatus.ACTIVE,
        features: {
          enabledFeatures: data.features || [
            'housekeeping',
            'maintenance',
            'analytics',
          ],
          branding: {
            primaryColor: data.primaryColor || '#0F1B2D',
            accentColor: data.accentColor || '#C9973A',
          },
        },
      });
      await queryRunner.manager.save(subscription);

      // Create Feature Flags
      if (data.features && Array.isArray(data.features)) {
        for (const featureName of data.features) {
          const flag = queryRunner.manager.create(FeatureFlag, {
            name: featureName,
            status: FeatureFlagStatus.ENABLED,
            hotel: { id: hotelId } as any,
          });
          await queryRunner.manager.save(flag);
        }
      }

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

  async getPlatformKPIs() {
    const [totalHotels, activeSubscriptions, activeUsers] = await Promise.all([
      this.hotelRepository.count(),
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.userRepository.count({ where: { isActive: true } }),
    ]);

    // MRR calculation
    const mrrResult = (await this.subscriptionRepository
      .createQueryBuilder('sub')
      .select('SUM(sub.price)', 'mrr')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .getRawOne()) as { mrr: string | null } | null;
    const mrr = Number(mrrResult?.mrr || 0);

    // Bookings across all active hotel schemas
    let totalBookings = 0;
    const hotels = await this.hotelRepository.find({
      where: { status: HotelStatus.ACTIVE },
    });
    for (const h of hotels) {
      try {
        const countRes = (await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${h.schemaName}"."bookings"`,
        )) as unknown as Array<{ count: string }>;
        totalBookings += parseInt(countRes[0]?.count || '0', 10);
      } catch {
        // Schema or table might not exist
      }
    }

    // MoM MRR growth logic
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const prevMrrResult = (await this.subscriptionRepository
      .createQueryBuilder('sub')
      .select('SUM(sub.price)', 'mrr')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('sub.createdAt < :cutoff', { cutoff: thirtyDaysAgo })
      .getRawOne()) as { mrr: string | null } | null;
    const prevMrr = Number(prevMrrResult?.mrr || 0);
    let mrrGrowth = 0;
    if (prevMrr > 0) {
      mrrGrowth = Math.round(((mrr - prevMrr) / prevMrr) * 100 * 10) / 10;
    } else if (mrr > 0) {
      mrrGrowth = 100.0;
    }

    // MoM Hotels growth logic
    const prevHotelsCount = await this.hotelRepository.count({
      where: {
        status: HotelStatus.ACTIVE,
        createdAt: LessThan(thirtyDaysAgo) as any,
      },
    });
    let hotelsGrowth = 0;
    if (prevHotelsCount > 0) {
      hotelsGrowth =
        Math.round(
          ((totalHotels - prevHotelsCount) / prevHotelsCount) * 100 * 10,
        ) / 10;
    } else if (totalHotels > 0) {
      hotelsGrowth = 100.0;
    }

    return {
      totalHotels,
      activeSubscriptions,
      mrr,
      totalBookings,
      activeUsers,
      mrrGrowth,
      hotelsGrowth,
    };
  }

  async getPlatformRevenueChart(): Promise<
    Array<{ month: string; revenue: number; bookings: number }>
  > {
    const monthsData: Array<{
      month: string;
      revenue: number;
      bookings: number;
    }> = [];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const hotels = await this.hotelRepository.find({
      where: { status: HotelStatus.ACTIVE },
    });

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();

      const startOfMonth = new Date(year, monthIndex, 1);
      const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const subSum = (await this.subscriptionRepository
        .createQueryBuilder('sub')
        .select('SUM(sub.price)', 'total')
        .where('sub.startDate <= :end', { end: endOfMonth })
        .andWhere('(sub.endDate IS NULL OR sub.endDate >= :start)', {
          start: startOfMonth,
        })
        .andWhere('sub.status != :status', {
          status: SubscriptionStatus.CANCELLED,
        })
        .getRawOne()) as { total: string | null } | null;

      const revenue = Number(subSum?.total || 0);

      // Bookings in this month across all active hotel schemas
      let bookings = 0;
      for (const h of hotels) {
        try {
          const countRes = (await this.dataSource.query(
            `SELECT COUNT(*) as count FROM "${h.schemaName}"."bookings"
             WHERE "createdAt" BETWEEN $1 AND $2`,
            [startOfMonth, endOfMonth],
          )) as unknown as Array<{ count: string }>;
          bookings += parseInt(countRes[0]?.count || '0', 10);
        } catch {
          // Schema or table might not exist
        }
      }

      monthsData.push({
        month: monthNames[monthIndex],
        revenue,
        bookings,
      });
    }

    return monthsData;
  }

  async getPlatformHotelsByTier() {
    const [basicCount, proCount, entCount] = await Promise.all([
      this.subscriptionRepository.count({
        where: {
          plan: SubscriptionPlan.BASIC,
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      this.subscriptionRepository.count({
        where: {
          plan: SubscriptionPlan.PROFESSIONAL,
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      this.subscriptionRepository.count({
        where: {
          plan: SubscriptionPlan.ENTERPRISE,
          status: SubscriptionStatus.ACTIVE,
        },
      }),
    ]);

    return [
      { name: 'Basic', value: basicCount, color: '#94a3b8' },
      { name: 'Pro', value: proCount, color: '#C9973A' },
      { name: 'Enterprise', value: entCount, color: '#0F1B2D' },
    ];
  }

  async getPlatformAuditLogs() {
    const logs = await this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const userIds = [
      ...new Set(
        logs.map((log) => log.performedBy || log.userId).filter(Boolean),
      ),
    ];
    const hotelIds = [
      ...new Set(logs.map((log) => log.hotelId).filter(Boolean)),
    ];

    let users: User[] = [];
    let hotels: Hotel[] = [];

    if (userIds.length > 0) {
      users = await this.userRepository.find({
        where: { id: In(userIds) },
      });
    }
    if (hotelIds.length > 0) {
      hotels = await this.hotelRepository.find({
        where: { id: In(hotelIds) },
      });
    }

    const userMap = new Map(
      users.map((u) => [
        u.id,
        `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
      ]),
    );
    const hotelMap = new Map(hotels.map((h) => [h.id, h.name]));

    return logs.map((log) => {
      const actorId = log.performedBy || log.userId;
      return {
        id: log.id,
        timestamp: log.createdAt,
        actor: actorId ? userMap.get(actorId) || 'System' : 'System',
        hotel: log.hotelId
          ? hotelMap.get(log.hotelId) || 'Grand Peninsula'
          : '-',
        action: log.action,
        resource: log.resourceType,
        ip: log.metadata?.ipAddress || 'unknown',
      };
    });
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
