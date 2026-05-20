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
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

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
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'scope', 'firstName', 'lastName'],
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(
    user: any,
    hotelId?: string | null,
    metadata?: { userAgent?: string; ipAddress?: string; device?: string },
    isImpersonating = false,
  ) {
    let permissions: string[] = [];
    let roleName = 'USER';

    if (hotelId) {
      // Impersonation check: Platform users with proper permissions can bypass normal access checks
      if (user.scope === UserScope.PLATFORM && isImpersonating) {
        // We'll verify the 'platform:impersonate' permission here if needed, 
        // but it's better handled in the controller calling this.
        roleName = 'SUPPORT_ADMIN';
        permissions = ['*']; // Full access during impersonation
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

        // Resolve permissions for the role
        const rolePermissions = await this.rolePermissionRepository.find({
          where: { roleId: access.roleId },
        });

        const permissionIds = rolePermissions.map((rp) => rp.permissionId);
        if (permissionIds.length > 0) {
          const perms = await this.permissionRepository.find({
            where: { id: In(permissionIds) },
          });
          permissions = perms.map((p) => p.slug);
        }
      }
    } else {
      // PLATFORM SCOPE: Resolve role from database instead of hardcoding SUPER_ADMIN
      const userWithRole = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['role'],
      });
      
      roleName = userWithRole?.role?.name ?? (user.scope === UserScope.PLATFORM ? 'PLATFORM_USER' : 'USER');
      
      // For platform users, we might want to resolve global permissions here too
      // (Implementation depends on how platform roles/permissions are mapped)
      if (roleName === 'SUPER_ADMIN') {
        permissions = ['*'];
      }
    }

    const payload = {
      sub: user.id,
      email: user.email,
      hotel_id: hotelId || null,
      scope: user.scope,
      permissions,
      role: roleName,
      is_impersonating: isImpersonating,
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
