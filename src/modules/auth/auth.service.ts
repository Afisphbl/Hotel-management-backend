import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
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
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(HotelUserAccess)
    private accessRepository: Repository<HotelUserAccess>,
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
    hotelId?: string,
    metadata?: { userAgent?: string; ipAddress?: string; device?: string },
  ) {
    let permissions: string[] = [];
    const roleName = 'USER';

    if (hotelId) {
      const access = await this.accessRepository.findOne({
        where: { userId: user.id, hotelId },
      });

      if (!access) {
        throw new UnauthorizedException('No access to this hotel');
      }

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

    const payload = {
      sub: user.id,
      email: user.email,
      hotel_id: hotelId || null,
      scope: user.scope,
      permissions,
      role: roleName,
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
      hotelId: hotelId || null,
      action: AuditAction.LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      description: `User ${user.email} logged in`,
      metadata,
      performedBy: user.id,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken.token,
      expires_in: this.configService.get('JWT_EXPIRATION'),
    };
  }

  async generateRefreshToken(
    userId: string,
    hotelId: string | null,
    metadata?: any,
  ): Promise<RefreshToken> {
    const token = randomBytes(32).toString('hex');
    const expiresIn = this.configService.get('REFRESH_TOKEN_EXPIRATION', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days

    const refreshToken = this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt,
      status: RefreshTokenStatus.ACTIVE,
      metadata,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  async refreshTokens(
    refreshToken: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ) {
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.status === RefreshTokenStatus.REVOKED) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (
      tokenRecord.status === RefreshTokenStatus.EXPIRED ||
      tokenRecord.expiresAt < new Date()
    ) {
      tokenRecord.status = RefreshTokenStatus.EXPIRED;
      await this.refreshTokenRepository.save(tokenRecord);
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.userRepository.findOne({
      where: { id: tokenRecord.userId },
      select: ['id', 'email', 'scope', 'firstName', 'lastName'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Revoke old refresh token
    tokenRecord.status = RefreshTokenStatus.REVOKED;
    tokenRecord.revokedAt = new Date();
    tokenRecord.revokedBy = user.id;
    await this.refreshTokenRepository.save(tokenRecord);

    // Create audit log for refresh
    await this.createAuditLog({
      userId: user.id,
      hotelId: null,
      action: AuditAction.REFRESH_TOKEN,
      resourceType: AuditResource.REFRESH_TOKEN,
      resourceId: tokenRecord.id,
      description: `Refresh token rotated for user ${user.email}`,
      metadata,
      performedBy: user.id,
    });

    // Generate new tokens
    return this.login(user, null, metadata);
  }

  async revokeRefreshToken(refreshToken: string, userId: string) {
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, userId },
    });

    if (!tokenRecord) {
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
    hotelId?: string;
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
}
