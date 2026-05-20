import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Repository, DataSource, LessThan, MoreThan, IsNull } from 'typeorm';
import {
  PlatformUser,
  UserStatus,
  UserRole,
} from '../../database/entities/global/platform-user.entity';
import { Role } from '../../database/entities/global/role.entity';
import { GlobalSetting } from '../../database/entities/global/global-setting.entity';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';

export interface AccountLockoutConfig {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  lockoutThreshold: number;
}

const DEFAULT_LOCKOUT_CONFIG: AccountLockoutConfig = {
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 30,
  lockoutThreshold: 3,
};

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    private dataSource: DataSource,
    private redisService: RedisService,
  ) {}

  private get userRepository(): Repository<PlatformUser> {
    return this.dataSource.getRepository(PlatformUser);
  }

  private get roleRepository(): Repository<Role> {
    return this.dataSource.getRepository(Role);
  }

  async getLockoutConfig(): Promise<AccountLockoutConfig> {
    const setting = await this.dataSource.getRepository(GlobalSetting).findOne({
      where: { key: 'security:account_lockout' },
    });
    return setting?.value ?? DEFAULT_LOCKOUT_CONFIG;
  }

  async updateLockoutConfig(
    config: Partial<AccountLockoutConfig>,
  ): Promise<AccountLockoutConfig> {
    const repository = this.dataSource.getRepository(GlobalSetting);
    const current = await this.getLockoutConfig();
    const merged = { ...current, ...config };
    let setting = await repository.findOne({
      where: { key: 'security:account_lockout' },
    });
    if (setting) {
      setting.value = merged;
    } else {
      setting = repository.create({
        key: 'security:account_lockout',
        value: merged,
        description: 'Account lockout policy configuration',
      });
    }
    await repository.save(setting);
    return merged;
  }

  async recordFailedLogin(userId: string, ipAddress?: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;

    const config = await this.getLockoutConfig();
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    user.lastFailedLoginAt = new Date();
    if (ipAddress) user.lastFailedLoginIp = ipAddress;

    if (user.failedLoginAttempts >= config.maxFailedAttempts) {
      user.isLocked = true;
      user.lockedUntil = new Date(
        Date.now() + config.lockoutDurationMinutes * 60 * 1000,
      );
      user.lockedAt = new Date();
      user.lockReason = `Account locked after ${user.failedLoginAttempts} failed login attempts`;
      this.logger.warn(
        `Account locked: ${user.email} until ${user.lockedUntil}`,
      );
    }

    await this.userRepository.save(user);
  }

  async checkAccountLockout(email: string): Promise<{
    locked: boolean;
    remainingAttempts?: number;
    lockedUntil?: Date;
  }> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return { locked: false };

    if (user.isLocked && user.lockedUntil) {
      if (user.lockedUntil > new Date()) {
        return { locked: true, lockedUntil: user.lockedUntil };
      }
      user.isLocked = false;
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
      await this.userRepository.save(user);
      return { locked: false };
    }

    const config = await this.getLockoutConfig();
    return {
      locked: false,
      remainingAttempts: Math.max(
        0,
        config.maxFailedAttempts - (user.failedLoginAttempts || 0),
      ),
    };
  }

  async resetLockout(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockedUntil = null;
    user.lockedAt = null;
    user.lockReason = null;
    await this.userRepository.save(user);
  }

  async findUserById(id: string): Promise<PlatformUser> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<PlatformUser | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['role'],
    });
  }

  async findAll(filter?: {
    status?: UserStatus;
    roleId?: string;
    search?: string;
  }): Promise<PlatformUser[]> {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    if (filter?.status) {
      qb.andWhere('user.status = :status', { status: filter.status });
    }
    if (filter?.roleId) {
      qb.andWhere('user.roleId = :roleId', { roleId: filter.roleId });
    }
    if (filter?.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }
    return qb.orderBy('user.createdAt', 'DESC').getMany();
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    roleId?: string;
    roleName?: UserRole;
  }): Promise<PlatformUser> {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });
    if (existing)
      throw new ConflictException('User with this email already exists');

    let role = data.roleId
      ? await this.roleRepository.findOne({ where: { id: data.roleId } })
      : null;
    if (!role && data.roleName) {
      role = await this.roleRepository.findOne({
        where: { name: data.roleName },
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      status: UserStatus.ACTIVE,
      role: role || undefined,
      activatedAt: new Date(),
      lastPasswordChangeAt: new Date(),
      mustChangePassword: true,
    });
    return this.userRepository.save(user);
  }

  async deactivateUser(
    id: string,
    reason?: string,
    deactivatedBy?: string,
  ): Promise<PlatformUser> {
    const user = await this.findUserById(id);
    user.status = UserStatus.INACTIVE;
    user.deactivatedAt = new Date();
    user.deactivatedBy = deactivatedBy ?? null;
    user.deactivationReason = reason ?? null;
    return this.userRepository.save(user);
  }

  async activateUser(id: string): Promise<PlatformUser> {
    const user = await this.findUserById(id);
    user.status = UserStatus.ACTIVE;
    user.activatedAt = new Date();
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    user.lockedUntil = null;
    return this.userRepository.save(user);
  }

  async suspendUser(id: string, reason?: string): Promise<PlatformUser> {
    const user = await this.findUserById(id);
    user.status = UserStatus.SUSPENDED;
    return this.userRepository.save(user);
  }

  async updateUser(
    id: string,
    data: Partial<PlatformUser>,
  ): Promise<PlatformUser> {
    const user = await this.findUserById(id);
    const allowedFields = [
      'firstName',
      'lastName',
      'phone',
      'preferences',
    ] as const;
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        (user as any)[field] = data[field];
      }
    }
    return this.userRepository.save(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password', 'passwordHistory', 'lastPasswordChangeAt'],
    });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      throw new BadRequestException('Current password is incorrect');

    const history = user.passwordHistory || [];
    for (const oldHash of history) {
      const match = await bcrypt.compare(newPassword, oldHash);
      if (match)
        throw new BadRequestException('Cannot reuse a previous password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    history.push(user.password);
    if (history.length > 10) history.shift();

    user.password = hashedPassword;
    user.passwordHistory = history;
    user.lastPasswordChangeAt = new Date();
    user.mustChangePassword = false;
    await this.userRepository.save(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findUserById(id);
    await this.userRepository.softDelete(id);
  }

  async getUsersByRole(roleName: UserRole): Promise<PlatformUser[]> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
    });
    if (!role) throw new NotFoundException('Role not found');
    return this.userRepository.find({
      where: { role: { id: role.id } as any },
      relations: ['role'],
    });
  }
}
