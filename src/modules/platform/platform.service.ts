import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In, IsNull } from 'typeorm';
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
import { RoleScope } from '../../database/entities/role.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { PaginatedResult } from '../../common/pagination/pagination.interface';

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

  async findAllHotelsPaginated(options: {
    page: number;
    limit: number;
    search?: string;
    plan?: string;
    sortBy?: string;
  }): Promise<PaginatedResult<any>> {
    const { page, limit, search, plan, sortBy } = options;
    const qb = this.hotelRepository.createQueryBuilder('hotel');

    // Join with active subscription to get the plan
    qb.leftJoinAndMapOne(
      'hotel.activeSubscription',
      Subscription,
      'sub',
      'sub.hotelId = hotel.id AND sub.status = :activeStatus',
      { activeStatus: SubscriptionStatus.ACTIVE },
    );

    if (search) {
      qb.andWhere(
        '(hotel.name ILIKE :search OR hotel.ownerName ILIKE :search OR hotel.ownerEmail ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (plan && plan !== 'all') {
      let planValue = plan.toUpperCase();
      if (planValue === 'PRO') planValue = SubscriptionPlan.PROFESSIONAL;
      qb.andWhere('sub.plan = :plan', { plan: planValue });
    }

    // Sorting
    if (sortBy) {
      const [field, order] = sortBy.split('-');
      const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
      if (field === 'name') {
        qb.orderBy('hotel.name', sortOrder);
      } else if (field === 'rooms') {
        qb.orderBy('hotel.rooms', sortOrder);
      } else if (field === 'created') {
        qb.orderBy('hotel.createdAt', sortOrder);
      }
    } else {
      qb.orderBy('hotel.createdAt', 'DESC');
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [hotels, total] = await qb.getManyAndCount();
    const enrichedHotels: any[] = [];

    for (const hotel of hotels) {
      const activeSub = (hotel as any).activeSubscription;
      const rawPlan = activeSub?.plan || SubscriptionPlan.BASIC;
      const planLabel =
        rawPlan === SubscriptionPlan.PROFESSIONAL
          ? 'Pro'
          : rawPlan.charAt(0) + rawPlan.slice(1).toLowerCase();

      let totalRooms = hotel.rooms;
      try {
        const dbRooms = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${hotel.schemaName}"."rooms"`,
        );
        totalRooms = parseInt(dbRooms[0]?.count || String(hotel.rooms), 10);
      } catch {
        // Fallback to the stored value on the global hotel record.
      }

      enrichedHotels.push({
        id: hotel.id,
        name: hotel.name,
        subdomain: hotel.subdomain,
        schemaName: hotel.schemaName,
        status: hotel.status,
        created: hotel.createdAt,
        owner: hotel.ownerName,
        ownerName: hotel.ownerName,
        email: hotel.ownerEmail,
        ownerEmail: hotel.ownerEmail,
        plan: planLabel,
        planRaw: rawPlan,
        subscriptionId: activeSub?.id ?? null,
        rooms: totalRooms,
        totalRooms,
      });
    }

    return {
      items: enrichedHotels,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

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
      const ownerEmail = hotel.ownerEmail || null;
      let ownerName = hotel.ownerName || null;
      if (!ownerName && ownerEmail) {
        const ownerUser = await this.userRepository.findOne({
          where: { email: ownerEmail },
        });
        if (ownerUser) {
          ownerName = `${ownerUser.firstName} ${ownerUser.lastName}`.trim();
        }
      }

      // 3. Resolve current room count from the tenant database when available
      let totalRooms = hotel.rooms;
      try {
        const dbRooms = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${hotel.schemaName}"."rooms"`,
        );
        totalRooms = parseInt(dbRooms[0]?.count || String(hotel.rooms), 10);
      } catch {
        // Fallback to the stored value on the global hotel record.
      }

      enrichedHotels.push({
        id: hotel.id,
        name: hotel.name,
        subdomain: hotel.subdomain,
        schemaName: hotel.schemaName,
        status: hotel.status,
        created: hotel.createdAt,
        owner: ownerName,
        ownerName,
        email: ownerEmail,
        ownerEmail,
        plan,
        rooms: totalRooms,
        totalRooms,
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
      const slug = data.code
        ? data.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      // 1. Create Hotel Record in Global Schema
      const hotel = Object.assign(new Hotel(), {
        name: data.name,
        slug,
        type: 'BOUTIQUE',
        ownerName: data.ownerName || null,
        ownerEmail: data.ownerEmail || null,
        subdomain: data.subdomain || subdomain,
        schemaName: schemaName,
        status: HotelStatus.ACTIVE,
        location: data.city
          ? `${data.city}, ${data.country || 'United Kingdom'}`
          : 'London, United Kingdom',
        timezone: data.timezone || 'UTC',
        currency: 'ETB',
        rooms: data.rooms || 0,
      });
      hotel.id = hotelId;

      const savedHotel = await queryRunner.manager.save(Hotel, hotel);

      // Create or reuse owner user if provided
      if (data.ownerEmail) {
        const nameParts = (data.ownerName || 'Hotel Owner').split(' ');
        const firstName = nameParts[0] || 'Hotel';
        const lastName = nameParts.slice(1).join(' ') || 'Owner';

        let user = await queryRunner.manager.findOne(User, {
          where: { email: data.ownerEmail },
        });

        if (!user) {
          const rawPassword =
            data.password ||
            (await this.passwordPolicyService.generateTemporaryPassword());
          if (!data.password) {
            temporaryPassword = rawPassword;
          }
          await this.passwordPolicyService.assertCompliant(rawPassword);
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          user = queryRunner.manager.create(User, {
            email: data.ownerEmail,
            password: hashedPassword,
            firstName,
            lastName,
            scope: UserScope.HOTEL,
            isActive: true,
          });
          user = await queryRunner.manager.save(user);
        } else {
          user.firstName = user.firstName || firstName;
          user.lastName = user.lastName || lastName;
          if (user.scope !== UserScope.HOTEL) {
            user.scope = UserScope.HOTEL;
          }
          user = await queryRunner.manager.save(user);
        }

        // Find or create HOTEL_OWNER role
        let ownerRole = await queryRunner.manager.findOne(Role, {
          where: { name: 'HOTEL_OWNER' },
        });
        if (!ownerRole) {
          ownerRole = queryRunner.manager.create(Role, {
            name: 'HOTEL_OWNER',
            scope: RoleScope.HOTEL,
            description: 'Primary owner access for a hotel tenant',
            isSystem: true,
            hierarchyLevel: 100,
          });
          ownerRole = await queryRunner.manager.save(ownerRole);
        }

        // Keep HOTEL_ADMIN available for delegated hotel operators
        let hotelAdminRole = await queryRunner.manager.findOne(Role, {
          where: { name: 'HOTEL_ADMIN' },
        });
        if (!hotelAdminRole) {
          hotelAdminRole = queryRunner.manager.create(Role, {
            name: 'HOTEL_ADMIN',
            scope: RoleScope.HOTEL,
            description: 'Delegated administration for hotel operations',
            isSystem: true,
            hierarchyLevel: 80,
          });
          hotelAdminRole = await queryRunner.manager.save(hotelAdminRole);
        }

        // Create HotelUserAccess for the owner
        const userAccess = queryRunner.manager.create(HotelUserAccess, {
          userId: user.id,
          hotelId: savedHotel.id,
          roleId: ownerRole.id,
          grantedAt: new Date(),
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
        currency: 'ETB',
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

      // 2. Create the Physical Schema and provision all tenant tables
      await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await this.provisionTenantSchema(queryRunner, schemaName);

      // 3. Auto-generate rooms if rooms count provided
      const roomCount = data.rooms || 0;
      if (roomCount > 0) {
        const floorsNeeded = Math.ceil(roomCount / 10);
        let roomsCreated = 0;
        for (
          let floor = 1;
          floor <= floorsNeeded && roomsCreated < roomCount;
          floor++
        ) {
          for (let num = 1; num <= 10 && roomsCreated < roomCount; num++) {
            const roomNumber = `${floor}${String(num).padStart(2, '0')}`;
            await queryRunner.query(
              `INSERT INTO "${schemaName}"."rooms" ("roomNumber", floor, "hotelId", status) VALUES ($1, $2, $3, 'available')`,
              [roomNumber, String(floor), hotelId],
            );
            roomsCreated++;
          }
        }
      }

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

  async reprovisionHotelSchema(hotelId: string) {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel) throw new NotFoundException('Hotel not found');
    if (!hotel.schemaName)
      throw new InternalServerErrorException('Hotel has no schema name');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query(
        `CREATE SCHEMA IF NOT EXISTS "${hotel.schemaName}"`,
      );
      await this.provisionTenantSchema(queryRunner, hotel.schemaName);

      // Seed rooms if table is empty and hotel has a rooms count
      const existing = await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "${hotel.schemaName}"."rooms"`,
      );
      const existingCount = Number(existing[0]?.count ?? 0);
      const roomCount = hotel.rooms || 0;
      if (existingCount === 0 && roomCount > 0) {
        const floorsNeeded = Math.ceil(roomCount / 10);
        let roomsCreated = 0;
        for (
          let floor = 1;
          floor <= floorsNeeded && roomsCreated < roomCount;
          floor++
        ) {
          for (let num = 1; num <= 10 && roomsCreated < roomCount; num++) {
            const roomNumber = `${floor}${String(num).padStart(2, '0')}`;
            await queryRunner.query(
              `INSERT INTO "${hotel.schemaName}"."rooms" ("roomNumber", floor, "hotelId", status) VALUES ($1, $2, $3, 'available')`,
              [roomNumber, String(floor), hotelId],
            );
            roomsCreated++;
          }
        }
        await this.hotelRepository.update(hotelId, { rooms: roomsCreated });
      }

      return {
        success: true,
        schemaName: hotel.schemaName,
        roomsSeeded: existingCount === 0 ? roomCount : 0,
      };
    } finally {
      await queryRunner.release();
    }
  }

  private async provisionTenantSchema(
    queryRunner: any,
    schemaName: string,
  ): Promise<void> {
    const s = schemaName;
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."room_types" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        "baseCapacity" INT NOT NULL,
        "maxExtraBeds" INT NOT NULL DEFAULT 0,
        "basePrice" NUMERIC(12,2) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."rooms" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roomNumber" VARCHAR NOT NULL,
        floor VARCHAR NOT NULL,
        "hotelId" VARCHAR NOT NULL,
        "roomTypeId" UUID REFERENCES "${s}"."room_types"(id),
        "basePrice" NUMERIC(12,2),
        "baseCapacity" INT,
        status VARCHAR NOT NULL DEFAULT 'available',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ,
        UNIQUE("hotelId", "roomNumber")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."guests" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "firstName" VARCHAR NOT NULL,
        "lastName" VARCHAR NOT NULL,
        email VARCHAR NOT NULL UNIQUE,
        phone VARCHAR,
        "documentType" VARCHAR,
        "documentNumber" VARCHAR,
        metadata JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."bookings" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "guestId" UUID NOT NULL REFERENCES "${s}"."guests"(id),
        "checkIn" TIMESTAMPTZ NOT NULL,
        "checkOut" TIMESTAMPTZ NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        "totalPrice" NUMERIC(12,2) NOT NULL,
        "idempotencyKey" VARCHAR NOT NULL UNIQUE,
        "priceSnapshot" JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."booking_rooms" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookingId" UUID NOT NULL REFERENCES "${s}"."bookings"(id),
        "roomId" UUID NOT NULL REFERENCES "${s}"."rooms"(id),
        price NUMERIC(12,2) NOT NULL,
        "nightPrices" JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."room_nights" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roomId" UUID NOT NULL REFERENCES "${s}"."rooms"(id),
        date DATE NOT NULL,
        status VARCHAR NOT NULL,
        "bookingId" UUID REFERENCES "${s}"."bookings"(id),
        price NUMERIC(12,2) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ,
        UNIQUE("roomId", date)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."staff" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" VARCHAR NOT NULL,
        "firstName" VARCHAR NOT NULL,
        "lastName" VARCHAR NOT NULL,
        email VARCHAR NOT NULL UNIQUE,
        phone VARCHAR,
        role VARCHAR NOT NULL,
        "employmentType" VARCHAR NOT NULL DEFAULT 'full_time',
        status VARCHAR NOT NULL DEFAULT 'active',
        "hourlyRate" NUMERIC(12,2),
        department VARCHAR,
        "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."shifts" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "staffId" UUID NOT NULL,
        "startTime" TIMESTAMPTZ NOT NULL,
        "endTime" TIMESTAMPTZ NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'scheduled',
        "checkInTime" TIMESTAMPTZ,
        "checkOutTime" TIMESTAMPTZ,
        notes TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."housekeeping_tasks" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roomId" UUID NOT NULL,
        "assignedTo" UUID,
        status VARCHAR NOT NULL DEFAULT 'pending',
        priority VARCHAR NOT NULL DEFAULT 'medium',
        description TEXT NOT NULL,
        "scheduledDate" DATE,
        "completedAt" TIMESTAMPTZ,
        notes TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."maintenance_tickets" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roomId" UUID NOT NULL,
        "reportedBy" VARCHAR NOT NULL,
        "assignedTo" UUID,
        title VARCHAR NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'reported',
        priority VARCHAR NOT NULL DEFAULT 'medium',
        category VARCHAR,
        "resolvedAt" TIMESTAMPTZ,
        cost NUMERIC(12,2),
        notes TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."tax_rules" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        rate NUMERIC(5,2) NOT NULL,
        application VARCHAR NOT NULL DEFAULT 'percentage',
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "validFrom" DATE,
        "validTo" DATE,
        description TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."rate_plans" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        "roomTypeId" UUID NOT NULL REFERENCES "${s}"."room_types"(id),
        "weekdayAdjustment" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "weekendAdjustment" NUMERIC(5,2) NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."seasonal_rates" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        "roomTypeId" UUID NOT NULL REFERENCES "${s}"."room_types"(id),
        "startDate" DATE NOT NULL,
        "endDate" DATE NOT NULL,
        "fixedPrice" NUMERIC(12,2),
        multiplier NUMERIC(5,2),
        priority INT NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."price_overrides" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "roomTypeId" UUID NOT NULL REFERENCES "${s}"."room_types"(id),
        date DATE NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        reason TEXT,
        "createdBy" VARCHAR,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."promotions" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        code VARCHAR,
        "roomTypeId" UUID REFERENCES "${s}"."room_types"(id),
        "discountType" VARCHAR NOT NULL,
        "discountValue" NUMERIC(12,2) NOT NULL,
        "startDate" DATE NOT NULL,
        "endDate" DATE NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."invoices" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceNumber" VARCHAR,
        "bookingId" UUID NOT NULL REFERENCES "${s}"."bookings"(id),
        amount NUMERIC(12,2) NOT NULL,
        subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        "taxTotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR NOT NULL DEFAULT 'ETB',
        status VARCHAR NOT NULL DEFAULT 'draft',
        "lineItems" JSONB,
        "dueDate" TIMESTAMPTZ,
        "paidAt" TIMESTAMPTZ,
        notes TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."payments" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" UUID NOT NULL REFERENCES "${s}"."invoices"(id),
        "bookingId" UUID REFERENCES "${s}"."bookings"(id),
        amount NUMERIC(12,2) NOT NULL,
        fee NUMERIC(12,2) NOT NULL DEFAULT 0,
        "netAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        currency VARCHAR NOT NULL DEFAULT 'ETB',
        method VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        "transactionId" VARCHAR,
        "gatewayResponse" JSONB,
        "idempotencyKey" VARCHAR,
        description TEXT,
        "paidAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."refunds" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "paymentId" UUID NOT NULL REFERENCES "${s}"."payments"(id),
        "invoiceId" UUID REFERENCES "${s}"."invoices"(id),
        "bookingId" UUID REFERENCES "${s}"."bookings"(id),
        amount NUMERIC(12,2) NOT NULL,
        currency VARCHAR NOT NULL DEFAULT 'ETB',
        reason VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'completed',
        "transactionId" VARCHAR,
        "idempotencyKey" VARCHAR,
        "processedAt" TIMESTAMPTZ,
        notes TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."ledger_entries" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "accountId" VARCHAR NOT NULL,
        debit NUMERIC(12,2) NOT NULL,
        credit NUMERIC(12,2) NOT NULL,
        currency VARCHAR NOT NULL DEFAULT 'ETB',
        "referenceType" VARCHAR NOT NULL,
        "referenceId" VARCHAR NOT NULL,
        "bookingId" UUID,
        "entryDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        description TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMPTZ
      )
    `);
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

    // Normalise status to uppercase to match HotelStatus enum values ('ACTIVE' | 'SUSPENDED')
    if (sanitizedData.status) {
      sanitizedData.status = sanitizedData.status.toUpperCase() as HotelStatus;
    }

    await this.hotelRepository.update(id, sanitizedData);
    return this.findHotelById(id);
  }

  async findHotelFeatures(hotelId: string) {
    const flags = await this.featureFlagRepository.find({
      where: [{ hotel: { id: hotelId } }, { hotel: IsNull() }],
      relations: ['hotel'],
    });

    if (flags.length === 0) {
      const sub = await this.subscriptionRepository.findOne({
        where: { hotel: { id: hotelId }, status: SubscriptionStatus.ACTIVE },
      });
      const defaultFeatures = [
        {
          id: 'housekeeping',
          name: 'Housekeeping Module',
          category: 'Operations',
        },
        {
          id: 'maintenance',
          name: 'Maintenance Module',
          category: 'Operations',
        },
        { id: 'pos', name: 'POS Integration', category: 'Integrations' },
        {
          id: 'whatsapp',
          name: 'WhatsApp Notifications',
          category: 'Guest Services',
        },
        { id: 'analytics', name: 'Advanced Analytics', category: 'Business' },
        {
          id: 'guest-portal',
          name: 'Guest Self-Service Portal',
          category: 'Guest Services',
        },
      ];
      const enabled = (sub?.features as any)?.enabledFeatures || [];
      return defaultFeatures.map((f) => ({
        ...f,
        id: f.id,
        status: enabled.includes(f.id)
          ? FeatureFlagStatus.ENABLED
          : FeatureFlagStatus.DISABLED,
      }));
    }

    const hotelOverrideNames = new Set(
      flags.filter((f) => f.hotel?.id === hotelId).map((f) => f.name),
    );

    const result: Array<{
      id: string;
      name: string;
      status: FeatureFlagStatus;
      category: string;
      rolloutStrategy?: FeatureFlagRolloutStrategy;
    }> = [];

    for (const flag of flags) {
      const isGlobal = !flag.hotel;
      const hasOverride = isGlobal && hotelOverrideNames.has(flag.name);

      if (isGlobal && hasOverride) continue;

      result.push({
        id: flag.id,
        name: flag.name,
        status: flag.status,
        category: flag.category || (isGlobal ? 'Global' : 'Operations'),
        rolloutStrategy: flag.rolloutStrategy,
      });
    }

    return result;
  }

  async toggleHotelFeature(
    hotelId: string,
    featureId: string,
    enabled: boolean,
  ) {
    const flag = await this.featureFlagRepository.findOne({
      where: { id: featureId },
      relations: ['hotel'],
    });

    if (!flag) {
      const sub = await this.subscriptionRepository.findOne({
        where: { hotel: { id: hotelId }, status: SubscriptionStatus.ACTIVE },
      });
      if (!sub) {
        throw new NotFoundException(
          'No active subscription found for this hotel',
        );
      }
      const features = (sub.features as any) || {};
      const enabledFeatures: string[] = features.enabledFeatures || [];
      if (enabled) {
        if (!enabledFeatures.includes(featureId)) {
          enabledFeatures.push(featureId);
        }
      } else {
        const idx = enabledFeatures.indexOf(featureId);
        if (idx !== -1) {
          enabledFeatures.splice(idx, 1);
        }
      }
      sub.features = { ...features, enabledFeatures };
      await this.subscriptionRepository.save(sub);
      return this.findHotelById(hotelId);
    }

    const isGlobalFlag = !flag.hotel;

    if (isGlobalFlag) {
      const override = await this.featureFlagRepository.findOne({
        where: { name: flag.name, hotel: { id: hotelId } },
      });
      if (override) {
        override.status = enabled
          ? FeatureFlagStatus.ENABLED
          : FeatureFlagStatus.DISABLED;
        await this.featureFlagRepository.save(override);
        return this.findFeatureFlagById(override.id);
      }
      const newFlag = this.featureFlagRepository.create({
        name: flag.name,
        description: flag.description,
        status: enabled
          ? FeatureFlagStatus.ENABLED
          : FeatureFlagStatus.DISABLED,
        hotel: { id: hotelId },
        rolloutStrategy: flag.rolloutStrategy,
        rolloutPercentage: flag.rolloutPercentage,
      });
      await this.featureFlagRepository.save(newFlag);
      return newFlag;
    }

    flag.status = enabled
      ? FeatureFlagStatus.ENABLED
      : FeatureFlagStatus.DISABLED;
    await this.featureFlagRepository.save(flag);
    return this.findFeatureFlagById(flag.id);
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

    // Delete related records from global schema to avoid FK constraint violations
    const tablesToClean = [
      'global.feature_flags',
      'global.subscriptions',
      'global.hotel_user_access',
      'global.tenant_quotas',
      'global.quota_alerts',
      'global.overage_billing',
      'global.maintenance_windows',
      'global.locale_settings',
      'global.custom_reports',
      'global.consent_records',
      'global.support_access',
      'global.emergency_access',
      'global.delegated_admins',
    ];

    for (const table of tablesToClean) {
      try {
        await this.dataSource.query(
          `DELETE FROM ${table} WHERE "hotelId" = $1`,
          [id],
        );
      } catch (e) {
        // Table might not exist or no records for this hotel
      }
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

  async getPlatformRoles() {
    const roles = await this.dataSource.query(
      `SELECT id, name, description, "hierarchyLevel", "isSystemRole" FROM global.roles ORDER BY "hierarchyLevel" DESC`,
    );

    return Promise.all(
      roles.map(async (role: any) => {
        const [userCountResult, permissionSlugsResult] = await Promise.all([
          this.dataSource.query(
            `SELECT COUNT(*)::int as count FROM global.users WHERE "roleId" = $1`,
            [role.id],
          ),
          this.dataSource.query(
            `SELECT p.slug FROM global.role_permissions rp JOIN global.permissions p ON rp."permissionId" = p.id WHERE rp."roleId" = $1`,
            [role.id],
          ),
        ]);

        return {
          id: role.id,
          name: role.name,
          description: role.description,
          hierarchyLevel: role.hierarchyLevel,
          isSystemRole: role.isSystemRole,
          users: parseInt(userCountResult[0]?.count ?? '0', 10),
          permissions: permissionSlugsResult.map((p: any) => p.slug),
        };
      }),
    );
  }

  async getPlatformPermissionsList() {
    return this.dataSource.query(
      `SELECT id, slug, description, "createdAt", "updatedAt" FROM global.permissions ORDER BY slug ASC`,
    );
  }

  async getPlatformRolesSummary() {
    const [userResult, roleResult, permResult, auditResult] = await Promise.all(
      [
        this.dataSource.query(
          `SELECT COUNT(*)::int as count FROM global.platform_users`,
        ),
        this.dataSource.query(
          `SELECT COUNT(*)::int as count FROM global.roles`,
        ),
        this.dataSource.query(
          `SELECT COUNT(*)::int as count FROM global.permissions`,
        ),
        this.dataSource.query(
          `SELECT "createdAt" FROM global.audit_logs ORDER BY "createdAt" DESC LIMIT 1`,
        ),
      ],
    );

    return {
      totalAdmins: userResult[0]?.count ?? 0,
      activeRoles: roleResult[0]?.count ?? 0,
      permissionSets: permResult[0]?.count ?? 0,
      lastAuditTimestamp: auditResult[0]?.createdAt ?? null,
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

    const [totalHotels, activeSubscriptions, activeUsers] = await Promise.all([
      this.hotelRepository.count(),
      this.subscriptionRepository.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.userRepository.count({ where: { isActive: true } }),
    ]);

    const mrrResult = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .select('SUM(sub.price)', 'mrr')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .getRawOne();

    const mrr = Number(mrrResult?.mrr || 0);

    const hotels = await this.hotelRepository.find({
      where: { status: HotelStatus.ACTIVE },
    });

    const bookingCounts = await Promise.all(
      hotels.map(async (h) => {
        try {
          const countRes = (await this.dataSource.query(
            `SELECT COUNT(*) as count FROM "${h.schemaName}"."bookings"`,
          )) as unknown as Array<{ count: string }>;
          return parseInt(countRes[0]?.count || '0', 10);
        } catch {
          return 0;
        }
      }),
    );

    const totalBookings = bookingCounts.reduce((sum, count) => sum + count, 0);

    return {
      totalHotels,
      activeSubscriptions,
      mrr,
      totalBookings,
      activeUsers,
      mrrGrowth: 0,
      hotelsGrowth: 0,
      isCached: false,
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

  async getPlatformAuditLogs(hotelId?: string) {
    const where: any = {};
    if (hotelId) where.hotelId = hotelId;
    const logs = await this.auditLogRepository.find({
      where,
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
        hotel: log.hotelId ? hotelMap.get(log.hotelId) || '-' : '-',
        action: log.action,
        resource: log.resourceType,
        ip: log.metadata?.ipAddress || '-',
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

    const readHotelRevenue = async (
      schemaName: string,
      statusClause: string,
    ) => {
      try {
        const rows = await this.dataSource.query(
          `SELECT COALESCE(SUM(amount), 0)::numeric AS revenue
           FROM "${schemaName}"."invoices"
           WHERE ${statusClause}`,
        );
        return Number(rows[0]?.revenue ?? 0);
      } catch {
        return 0;
      }
    };

    for (const hotel of hotels) {
      const hotelRevenue = await readHotelRevenue(
        hotel.schemaName,
        "status = 'paid'",
      );
      const hotelOutstanding = await readHotelRevenue(
        hotel.schemaName,
        "status IN ('issued', 'overdue', 'partially_paid')",
      );
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
      currency: 'ETB',
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

  async findTopSubscriptions(limit = 5) {
    const subs = await this.subscriptionRepository.find({
      where: { status: SubscriptionStatus.ACTIVE },
      relations: ['hotel'],
      order: { price: 'DESC' },
      take: limit,
    });
    return subs.map((sub) => ({
      id: sub.id,
      name: sub.hotel?.name || 'Unknown',
      plan:
        sub.plan === SubscriptionPlan.PROFESSIONAL
          ? 'Pro'
          : sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase(),
      monthlyRevenue: sub.price,
      status: sub.hotel?.status || 'inactive',
      hotelId: sub.hotel?.id,
    }));
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

  async findAllFeatureFlags(options?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    strategy?: string;
    scope?: 'global' | 'hotel' | 'all';
  }): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      strategy,
      scope = 'all',
    } = options || {};
    const skip = (page - 1) * limit;

    const qb = this.featureFlagRepository.createQueryBuilder('flag');
    qb.leftJoinAndSelect('flag.hotel', 'hotel');

    if (search) {
      qb.andWhere('flag.name ILIKE :search', { search: `%${search}%` });
    }

    if (status && status !== 'all') {
      qb.andWhere('flag.status = :status', { status: status.toUpperCase() });
    }

    if (strategy && strategy !== 'all') {
      qb.andWhere('flag.rolloutStrategy = :strategy', { strategy });
    }

    if (scope === 'global') {
      qb.andWhere('flag.hotelId IS NULL');
    } else if (scope === 'hotel') {
      qb.andWhere('flag.hotelId IS NOT NULL');
    }

    qb.orderBy('flag.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((flag) => ({
        id: flag.id,
        name: flag.name,
        description: flag.description,
        status: flag.status,
        category: flag.category,
        rolloutStrategy: flag.rolloutStrategy,
        rolloutPercentage: flag.rolloutPercentage,
        hotel: flag.hotel ? { id: flag.hotel.id, name: flag.hotel.name } : null,
        variants: flag.variants,
        createdAt: flag.createdAt,
        updatedAt: flag.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
    category?: string;
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
    if (data.category) flag.category = data.category;
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
      category: string;
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
    if (data.category) flag.category = data.category;
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

  async getRolloutSummary() {
    const flags = await this.featureFlagRepository.find({
      relations: ['hotel'],
    });
    const totalHotels = await this.hotelRepository.count();

    const grouped = new Map<
      string,
      {
        total: number;
        enabled: number;
        strategies: Set<string>;
        statuses: Set<string>;
      }
    >();

    for (const flag of flags) {
      if (!grouped.has(flag.name)) {
        grouped.set(flag.name, {
          total: 0,
          enabled: 0,
          strategies: new Set(),
          statuses: new Set(),
        });
      }
      const entry = grouped.get(flag.name)!;
      entry.total++;
      if (flag.status === FeatureFlagStatus.ENABLED) entry.enabled++;
      if (flag.rolloutStrategy) entry.strategies.add(flag.rolloutStrategy);
      entry.statuses.add(flag.status);
    }

    return Array.from(grouped.entries()).map(([name, data]) => {
      const percentage =
        totalHotels > 0 ? Math.round((data.enabled / totalHotels) * 100) : 0;
      const isFullEnabled =
        data.statuses.size === 1 && data.statuses.has('ENABLED');
      const isFullDisabled =
        data.statuses.size === 1 && data.statuses.has('DISABLED');

      return {
        name,
        percentage,
        total: data.total,
        enabled: data.enabled,
        status: isFullEnabled
          ? 'ENABLED'
          : isFullDisabled
            ? 'DISABLED'
            : 'PARTIAL',
        strategies: Array.from(data.strategies),
      };
    });
  }
}
