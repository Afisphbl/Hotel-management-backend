import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { User, UserScope } from '../../database/entities/user.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { Role } from '../../database/entities/role.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import {
  RefreshToken,
  RefreshTokenStatus,
} from '../../database/entities/refresh-token.entity';
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from '../../database/entities/audit-log.entity';
import { SupportAccess, SupportAccessStatus } from '../../database/entities/global/support-access.entity';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HotelUserAccess)
    private accessRepository: Repository<HotelUserAccess>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SupportAccess)
    private supportAccessRepository: Repository<SupportAccess>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'scope', 'firstName', 'lastName', 'twoFactorEnabled'],
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async generate2FASecret(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'Hotel Management Platform',
      secret,
    );

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      secret,
      qrCodeDataUrl,
    };
  }

  async verify2FASetup(userId: string, secret: string, code: string) {
    const isValid = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.userRepository.update(userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    });

    return { success: true };
  }

  async verify2FACode(userId: string, code: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'twoFactorSecret', 'twoFactorEnabled'],
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled');
    }

    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return true;
  }

  async login(
    user: any,
    hotelId?: string | null,
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
      device?: string;
      supportReason?: string;
    },
    isImpersonating = false,
  ) {
    let permissions: string[] = [];
    let roleName = 'USER';
    let supportAccessId: string | null = null;
    const userWithRole = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['role'],
    });
    const resolvedRoleId = userWithRole?.role?.id ?? user.role?.id;

    if (hotelId) {
      // Impersonation check: Platform users with proper permissions can bypass normal access checks
      if (user.scope === UserScope.PLATFORM && isImpersonating) {
        roleName = 'SUPPORT_ADMIN';
        permissions = await this.getHierarchicalPermissions(resolvedRoleId);
        const supportAccess = await this.supportAccessRepository.save(
          this.supportAccessRepository.create({
            platformUserId: user.id,
            hotelId,
            reason: metadata?.supportReason || 'Emergency support access',
            status: SupportAccessStatus.ACTIVE,
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
            metadata,
          }),
        );
        supportAccessId = supportAccess.id;
      } else {
        const access = await this.accessRepository.findOne({
          where: { userId: user.id, hotelId },
        });

        if (!access) {
          throw new UnauthorizedException('No access to this hotel');
        }

        // Resolve the actual role name
        const role = await this.roleRepository.findOne({
          where: { id: access.roleId },
        });
        roleName = role?.name ?? 'USER';
        permissions = await this.getHierarchicalPermissions(access.roleId);
      }
    } else {
      // PLATFORM SCOPE: Resolve role from database
      roleName = userWithRole?.role?.name ?? (user.scope === UserScope.PLATFORM ? 'PLATFORM_USER' : 'USER');
      permissions = await this.getHierarchicalPermissions(resolvedRoleId);
    }

    const payload = {
      sub: user.id,
      email: user.email,
      hotel_id: hotelId || null,
      scope: isImpersonating ? UserScope.HOTEL : user.scope,
      actor_scope: user.scope,
      permissions,
      role: roleName,
      is_impersonating: isImpersonating,
      support_access_id: supportAccessId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(
      user.id,
      hotelId,
      metadata,
    );

    // Create audit log
    await this.createAuditLog({
      userId: user.id,
      hotelId: hotelId ?? null,
      action: AuditAction.LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      description: `User ${user.email} logged in`,
      metadata,
      performedBy: user.id,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.configService.get('JWT_EXPIRATION'),
    };
  }

  async generateRefreshToken(
    userId: string,
    hotelId: string | null | undefined,
    metadata?: any,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(token);
    const expiresAt = this.getRefreshTokenExpiresAt();

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      hotelId: hotelId ?? null,
      token: tokenHash,
      expiresAt,
      status: RefreshTokenStatus.ACTIVE,
      metadata,
    });

    await this.refreshTokenRepository.save(refreshToken);
    return token;
  }

  async refreshTokens(
    refreshToken: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const revokeResult = await this.refreshTokenRepository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({
        status: RefreshTokenStatus.REVOKED,
        revokedAt: () => 'NOW()',
        revokedBy: () => '"userId"',
      })
      .where('token = :token', { token: tokenHash })
      .andWhere('status = :status', { status: RefreshTokenStatus.ACTIVE })
      .andWhere('"expiresAt" > NOW()')
      .execute();

    if (!revokeResult.affected) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });

    if (
      !tokenRecord ||
      !this.compareRefreshTokenHash(tokenRecord.token, tokenHash)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({
      where: { id: tokenRecord.userId },
      select: ['id', 'email', 'scope', 'firstName', 'lastName'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Create audit log for refresh
    await this.createAuditLog({
      userId: user.id,
      hotelId: tokenRecord.hotelId,
      action: AuditAction.REFRESH_TOKEN,
      resourceType: AuditResource.REFRESH_TOKEN,
      resourceId: tokenRecord.id,
      description: `Refresh token rotated for user ${user.email}`,
      metadata,
      performedBy: user.id,
    });

    // Generate new tokens
    return this.login(user, tokenRecord.hotelId, metadata);
  }

  async revokeRefreshToken(refreshToken: string, userId: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash, userId },
    });

    if (
      !tokenRecord ||
      !this.compareRefreshTokenHash(tokenRecord.token, tokenHash)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    tokenRecord.status = RefreshTokenStatus.REVOKED;
    tokenRecord.revokedAt = new Date();
    tokenRecord.revokedBy = userId;
    await this.refreshTokenRepository.save(tokenRecord);

    // Create audit log
    await this.createAuditLog({
      userId,
      hotelId: null,
      action: AuditAction.REVOKE_TOKEN,
      resourceType: AuditResource.REFRESH_TOKEN,
      resourceId: tokenRecord.id,
      description: `Refresh token revoked by user ${userId}`,
      performedBy: userId,
    });

    return { success: true };
  }

  async cleanupExpiredTokens() {
    const expiredTokens = await this.refreshTokenRepository.find({
      where: {
        status: RefreshTokenStatus.ACTIVE,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const token of expiredTokens) {
      token.status = RefreshTokenStatus.EXPIRED;
      await this.refreshTokenRepository.save(token);
    }

    return { cleaned: expiredTokens.length };
  }

  async revokeSupportAccess(supportAccessId: string): Promise<void> {
    const record = await this.supportAccessRepository.findOne({
      where: { id: supportAccessId },
    });

    if (!record) {
      return;
    }

    record.status = SupportAccessStatus.REVOKED;
    record.revokedAt = new Date();
    await this.supportAccessRepository.save(record);
  }

  private async getHierarchicalPermissions(roleId?: string): Promise<string[]> {
    if (!roleId) {
      return [];
    }

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      return [];
    }

    const inheritedRoles = await this.roleRepository
      .createQueryBuilder('role')
      .where('role.hierarchyLevel <= :level', { level: role.hierarchyLevel })
      .getMany();

    const roleIds = inheritedRoles.map((item) => item.id);
    if (roleIds.length === 0) {
      return [];
    }

    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: In(roleIds) },
    });

    const permissionIds = [...new Set(rolePermissions.map((rp) => rp.permissionId))];
    if (permissionIds.length === 0) {
      return [];
    }

    const permissions = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });

    return permissions.map((permission) => permission.slug);
  }

  private async createAuditLog(data: {
    userId?: string;
    hotelId?: string | null;
    action: AuditAction;
    resourceType: AuditResource;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    description?: string;
    metadata?: any;
    performedBy: string;
  }) {
    const auditLog = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(auditLog);
  }

  private hashRefreshToken(token: string): string {
    const secret = this.configService.getOrThrow<string>(
      'REFRESH_TOKEN_SECRET',
    );
    return createHmac('sha256', secret).update(token, 'utf8').digest('hex');
  }

  private compareRefreshTokenHash(a: string, b: string): boolean {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  }

  private getRefreshTokenExpiresAt(): Date {
    const expiresIn = this.configService.get<string>(
      'REFRESH_TOKEN_EXPIRATION',
      '7d',
    );
    const durationMs =
      this.parseDurationMs(expiresIn) ?? 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + durationMs);
  }

  private parseDurationMs(value: string): number | null {
    const trimmed = value.trim();
    const match = /^(\d+)([dhms])?$/.exec(trimmed);

    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    if (!Number.isSafeInteger(amount)) {
      return null;
    }

    const unit = match[2] ?? 's';
    const multipliers: Record<string, number> = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
      s: 1000,
    };

    return amount * multipliers[unit];
  }
}
