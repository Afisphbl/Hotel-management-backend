import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  HttpException,
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
  FeatureFlagRolloutStrategy,
} from '../../database/entities/global/feature-flag.entity';
import {
  GlobalSetting,
  SettingCategory,
} from '../../database/entities/global/global-setting.entity';
import {
  AnalyticsSnapshot,
  SnapshotType,
} from '../../database/entities/analytics-snapshot.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Role } from '../../database/entities/role.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { CreateHotelDto } from './dto/create-hotel.dto';

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
    @InjectRepository(GlobalSetting)
    private settingRepository: Repository<GlobalSetting>,
    @InjectRepository(AnalyticsSnapshot)
    private snapshotRepository: Repository<AnalyticsSnapshot>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly tenantQuotaService: TenantQuotaService,
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
      const owner = hotel.ownerName || 'John Doe';
      const email = hotel.ownerEmail || 'owner@example.com';

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
    const owner = hotel.ownerName || null;
    const email = hotel.ownerEmail || null;
    let phone: string | null = null;
    if (email) {
      try {
        const ownerUser = await this.dataSource.query(
          `SELECT phone FROM global.users WHERE email = $1 LIMIT 1`,
          [email],
        );
        if (ownerUser && ownerUser.length > 0 && ownerUser[0].phone) {
          phone = ownerUser[0].phone;
        }
      } catch {
        // Fallback
      }
    }

    // 3. Query count of rooms inside tenant schema
    let totalRooms = hotel.rooms;
    try {
      const dbRooms = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${hotel.schemaName}"."rooms"`,
      );
      totalRooms = parseInt(dbRooms[0]?.count || String(hotel.rooms), 10);
    } catch {
      // Fallback
    }

    // 4. Query count of users linked to this hotel from global
    let activeUsers: number | null = null;
    try {
      const dbUsers = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM global.hotel_user_access WHERE "hotelId" = $1`,
        [hotel.id],
      );
      const count = parseInt(dbUsers[0]?.count || '0', 10);
      activeUsers = count > 0 ? count : null;
    } catch {
      // Fallback
    }

    // 5. Query Feature Flags
    let featureFlags: Array<{ name: string; status: FeatureFlagStatus }> = [];
    try {
      const dbFlags = await this.featureFlagRepository.find({
        where: { hotel: { id } },
      });
      featureFlags = dbFlags.map((f) => ({ name: f.name, status: f.status }));
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
      location: hotel.location || null,
      totalRooms,
      currentOccupancy: null,
      monthlyRevenue: activeSub ? Number(activeSub.price) : 0,
      activeUsers,
      storageUsed: hotel.storageUsedMb
        ? `${(hotel.storageUsedMb / 1024).toFixed(1)} GB`
        : null,
      lastBackup: null,
      region: hotel.region || null,
      environment: 'production',
      timezone: hotel.timezone || null,
      currency: hotel.currency || null,
      branding: activeSub?.features?.branding || {
        primaryColor: '#0F1B2D',
        accentColor: '#C9973A',
        logo: '',
        favicon: '/favicon.ico',
        loginMessage: `Welcome to ${hotel.name} PMS`,
      },
      enabledFeatures: activeSub?.features?.enabledFeatures || [
        'housekeeping',
        'maintenance',
        'analytics',
      ],
      featureFlags:
        featureFlags.length > 0
          ? featureFlags
          : [
              { name: 'housekeeping', status: 'ENABLED' },
              { name: 'maintenance', status: 'ENABLED' },
              { name: 'analytics', status: 'ENABLED' },
            ],
    };
  }

  async createHotel(data: CreateHotelDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const hotelId = crypto.randomUUID();
      const schemaName = `hotel_${hotelId.replace(/-/g, '_')}`;
      let temporaryPassword: string | undefined;

      // Generate appropriate subdomain if not provided
      const subdomain = data.code
        ? data.code.toLowerCase().replace(/[^a-z0-9]/g, '')
        : data.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // 1. Create Hotel Record in Global Schema
      const hotel = Object.assign(new Hotel(), {
        name: data.name,
        ownerName: data.ownerName || null,
        ownerEmail: data.ownerEmail || null,
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
      hotel.id = hotelId;

      const savedHotel = await queryRunner.manager.save(Hotel, hotel);

      // Create owner user if provided
      if (data.ownerEmail) {
        const existingUser = await queryRunner.manager.findOne(User, {
          where: { email: data.ownerEmail },
        });
        if (existingUser) {
          throw new ConflictException(
            `A user with email ${data.ownerEmail} already exists. Use a different email for the hotel owner.`,
          );
        }

        const rawPassword =
          data.password ||
          (await this.passwordPolicyService.generateTemporaryPassword());
        if (!data.password) {
          temporaryPassword = rawPassword;
        }
        await this.passwordPolicyService.assertCompliant(rawPassword);
        const hashedPassword = await bcrypt.hash(rawPassword, 10);
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

        // Find or create HOTEL_ADMIN role
        let role = await queryRunner.manager.findOne(Role, {
          where: { name: 'HOTEL_ADMIN' },
        });
        if (!role) {
          role = queryRunner.manager.create(Role, {
            name: 'HOTEL_ADMIN',
            description: 'Full access to all hotel operations',
            isSystemRole: true,
            hierarchyLevel: 80,
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
      const rawPlan = String(data.plan || 'PROFESSIONAL').toUpperCase();
      const plan =
        rawPlan === SubscriptionPlan.BASIC
          ? SubscriptionPlan.BASIC
          : rawPlan === SubscriptionPlan.ENTERPRISE
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
      await this.tenantQuotaService.syncQuotaSnapshot(savedHotel.id);
      return {
        ...savedHotel,
        temporaryPassword,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      const message = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(
        `Failed to create hotel: ${message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateHotel(id: string, data: Partial<Hotel>) {
    const { id: _, ...validFields } = data as any;

    // Pick only valid Hotel columns to prevent TypeORM database schema failure
    const hotelColumns = [
      'name',
      'status',
      'subdomain',
      'location',
      'region',
      'timezone',
      'currency',
      'storageUsedMb',
      'rooms',
      'ownerName',
      'ownerEmail',
    ];
    const sanitizedData: any = {};
    for (const key of hotelColumns) {
      if (validFields[key] !== undefined) {
        sanitizedData[key] = validFields[key];
      }
    }

    // Normalise status to lowercase to match HotelStatus enum values ('active' | 'suspended')
    if (sanitizedData.status) {
      sanitizedData.status = sanitizedData.status.toLowerCase() as HotelStatus;
    }

    await this.hotelRepository.update(id, sanitizedData);
    return this.findHotelById(id);
  }

  async updateBranding(hotelId: string, brandingData: any) {
    const activeSub = await this.subscriptionRepository.findOne({
      where: { hotel: { id: hotelId }, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
    if (activeSub) {
      const currentFeatures = activeSub.features || {};
      activeSub.features = {
        ...currentFeatures,
        branding: {
          ...(currentFeatures.branding || {}),
          ...brandingData,
        },
      };
      await this.subscriptionRepository.save(activeSub);
    }
    return this.findHotelById(hotelId);
  }

  async deleteHotel(id: string) {
    const hotel = await this.hotelRepository.findOne({ where: { id } });
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    // Delete related records to avoid FK constraint violations
    try {
      await this.dataSource.query(
        `DELETE FROM global.feature_flags WHERE "hotelId" = $1`,
        [id],
      );
    } catch {
      /* table may not exist yet */
    }

    try {
      await this.dataSource.query(
        `DELETE FROM global.subscriptions WHERE "hotelId" = $1`,
        [id],
      );
    } catch {
      /* table may not exist yet */
    }

    try {
      await this.dataSource.query(
        `DELETE FROM global.hotel_user_access WHERE "hotelId" = $1`,
        [id],
      );
    } catch {
      /* table may not exist yet */
    }

    // Drop tenant-specific schema cleanly
    try {
      await this.dataSource.query(
        `DROP SCHEMA IF EXISTS "${hotel.schemaName}" CASCADE`,
      );
    } catch {
      /* schema may not exist */
    }

    await this.hotelRepository.delete(id);
    return { success: true, id };
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
    const latestSnapshot = await this.snapshotRepository.findOne({
      where: { snapshotType: SnapshotType.PLATFORM_KPI },
      order: { periodStart: 'DESC' },
    });

    if (latestSnapshot) {
      return {
        ...latestSnapshot.data,
        isCached: true,
        lastUpdated: latestSnapshot.createdAt,
      };
    }

    return {
      totalHotels: 0,
      activeSubscriptions: 0,
      mrr: 0,
      totalBookings: 0,
      activeUsers: 0,
      mrrGrowth: 0,
      hotelsGrowth: 0,
    };
  }

  async getPlatformRevenueChart(): Promise<
    Array<{ month: string; revenue: number; bookings: number }>
  > {
    const latestSnapshot = await this.snapshotRepository.findOne({
      where: { snapshotType: SnapshotType.PLATFORM_REVENUE },
      order: { periodStart: 'DESC' },
    });

    if (latestSnapshot && latestSnapshot.data.chart) {
      return latestSnapshot.data.chart;
    }

    return [];
  }

  // --- Global Settings ---

  async findAllSettings() {
    return this.settingRepository.find();
  }

  async updateSetting(key: string, value: any, category?: SettingCategory) {
    let setting = await this.settingRepository.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      if (category) setting.category = category;
    } else {
      setting = this.settingRepository.create({
        key,
        value,
        category: category || SettingCategory.SYSTEM,
      });
    }
    return this.settingRepository.save(setting);
  }

  async deleteSetting(key: string) {
    await this.settingRepository.delete({ key });
    return { success: true };
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

  async getRevenueSummary() {
    const hotels = await this.hotelRepository.find({
      order: { createdAt: 'DESC' },
    });
    const subscriptions = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['hotel'],
    });

    const revenueByHotel: Array<Record<string, any>> = [];
    let collectedRevenue = 0;
    let outstandingRevenue = 0;

    for (const hotel of hotels) {
      const paidInvoices = await this.dataSource.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS revenue
         FROM "${hotel.schemaName}"."invoices"
         WHERE status = 'paid'`,
      );
      const openInvoices = await this.dataSource.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS revenue
         FROM "${hotel.schemaName}"."invoices"
         WHERE status IN ('issued', 'overdue', 'partially_paid')`,
      );

      const hotelRevenue = Number(paidInvoices[0]?.revenue ?? 0);
      const hotelOutstanding = Number(openInvoices[0]?.revenue ?? 0);
      const monthlySubscriptionRevenue = Number(
        subscriptions.find((sub) => sub.hotel?.id === hotel.id)?.price ?? 0,
      );

      collectedRevenue += hotelRevenue;
      outstandingRevenue += hotelOutstanding;

      revenueByHotel.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        monthlySubscriptionRevenue,
        collectedRevenue: hotelRevenue,
        outstandingRevenue: hotelOutstanding,
      });
    }

    const mrr = subscriptions.reduce(
      (sum, subscription) => sum + Number(subscription.price ?? 0),
      0,
    );

    return {
      totalHotels: hotels.length,
      activeSubscriptions: subscriptions.length,
      mrr,
      arr: mrr * 12,
      collectedRevenue,
      outstandingRevenue,
      averageRevenuePerHotel:
        hotels.length > 0 ? collectedRevenue / hotels.length : 0,
      revenueByHotel,
    };
  }

  async getBillingReport() {
    const [revenueSummary, hotelsByTier, settings] = await Promise.all([
      this.getRevenueSummary(),
      this.getPlatformHotelsByTier(),
      this.settingRepository.find({
        where: [
          { key: 'payment_gateway:config' },
          { key: 'system:maintenance_mode' },
        ],
      }),
    ]);

    return {
      revenueSummary,
      hotelsByTier,
      paymentGatewayConfigured: settings.some(
        (setting) => setting.key === 'payment_gateway:config',
      ),
      maintenanceModeEnabled:
        settings.find((setting) => setting.key === 'system:maintenance_mode')
          ?.value === true,
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
    const rawPassword =
      data.password ||
      (await this.passwordPolicyService.generateTemporaryPassword());
    await this.passwordPolicyService.assertCompliant(rawPassword);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const user = this.userRepository.create({
      ...data,
      password: hashedPassword,
      scope: UserScope.PLATFORM,
      isActive: true,
      roleId: data.roleId || null,
    });
    const saved = await this.userRepository.save(user);
    const userEntity = Array.isArray(saved) ? saved[0] : saved;
    const { password, ...result } = userEntity;
    return {
      ...result,
      temporaryPassword: data.password ? undefined : rawPassword,
    };
  }

  // --- Subscription Management ---

  async findAllSubscriptions() {
    return this.subscriptionRepository.find({ relations: ['hotel'] });
  }

  async getSubscriptionPlans() {
    return [
      {
        code: SubscriptionPlan.BASIC,
        name: 'Basic',
        monthlyPrice: 99,
        limits: { rooms: 50, users: 10, storageMb: 1024 },
        features: ['housekeeping', 'maintenance', 'analytics'],
      },
      {
        code: SubscriptionPlan.PROFESSIONAL,
        name: 'Professional',
        monthlyPrice: 299,
        limits: { rooms: 200, users: 50, storageMb: 5120 },
        features: ['housekeeping', 'maintenance', 'analytics', 'automation'],
      },
      {
        code: SubscriptionPlan.ENTERPRISE,
        name: 'Enterprise',
        monthlyPrice: 999,
        limits: { rooms: 9999, users: 500, storageMb: 51200 },
        features: [
          'housekeeping',
          'maintenance',
          'analytics',
          'automation',
          'sso',
          'custom-support',
        ],
      },
    ];
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
    rolloutStrategy?: FeatureFlagRolloutStrategy;
    rolloutPercentage?: number;
    targetingRules?: Array<any>;
    allowedUserIds?: string[];
    allowedRoleIds?: string[];
    excludedUserIds?: string[];
    variants?: Array<any>;
  }) {
    const flag = this.featureFlagRepository.create();
    flag.name = data.name;
    if (data.description) flag.description = data.description;
    if (data.hotelId) flag.hotel = { id: data.hotelId } as any;
    flag.status = data.status || FeatureFlagStatus.DISABLED;
    if (data.conditions) flag.conditions = data.conditions;
    if (data.rolloutStrategy) flag.rolloutStrategy = data.rolloutStrategy;
    if (data.rolloutPercentage != null)
      flag.rolloutPercentage = data.rolloutPercentage;
    if (data.targetingRules) flag.targetingRules = data.targetingRules;
    if (data.allowedUserIds) flag.allowedUserIds = data.allowedUserIds;
    if (data.allowedRoleIds) flag.allowedRoleIds = data.allowedRoleIds;
    if (data.excludedUserIds) flag.excludedUserIds = data.excludedUserIds;
    if (data.variants) flag.variants = data.variants;
    return this.featureFlagRepository.save(flag);
  }

  async updateFeatureFlag(
    id: string,
    data: Partial<{
      description: string;
      status: FeatureFlagStatus;
      conditions: Record<string, any>;
      rolloutStrategy: FeatureFlagRolloutStrategy;
      rolloutPercentage: number;
      targetingRules: Array<any>;
      allowedUserIds: string[];
      allowedRoleIds: string[];
      excludedUserIds: string[];
      variants: Array<any>;
    }>,
  ) {
    const flag = await this.findFeatureFlagById(id);
    if (data.description !== undefined) flag.description = data.description;
    if (data.status) flag.status = data.status;
    if (data.conditions) flag.conditions = data.conditions;
    if (data.rolloutStrategy) flag.rolloutStrategy = data.rolloutStrategy;
    if (data.rolloutPercentage != null)
      flag.rolloutPercentage = data.rolloutPercentage;
    if (data.targetingRules) flag.targetingRules = data.targetingRules;
    if (data.allowedUserIds) flag.allowedUserIds = data.allowedUserIds;
    if (data.allowedRoleIds) flag.allowedRoleIds = data.allowedRoleIds;
    if (data.excludedUserIds) flag.excludedUserIds = data.excludedUserIds;
    if (data.variants) flag.variants = data.variants;
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
