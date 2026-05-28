import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../modules/redis/redis.service';
import { PlatformUser, UserStatus } from '../../database/entities/global';
import {
  Role,
  Permission,
  RolePermission,
} from '../../database/entities/global';
import {
  JWTPayload,
  RefreshTokenPayload,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(PlatformUser)
    private readonly userRepository: Repository<PlatformUser>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<PlatformUser | null> {
    const user = await this.userRepository.findOne({
      where: { email, status: UserStatus.ACTIVE },
      relations: ['role'],
    });

    console.log(user);

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async generateTokens(
    user: PlatformUser,
    hotelId?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const permissions = await this.getUserPermissions(user, hotelId);
    const accessTokenPayload: JWTPayload = {
      sub: user.id,
      hotel_id: hotelId,
      role: user.role?.name || 'USER',
      scope: hotelId ? 'HOTEL' : 'PLATFORM',
      permissions,
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) +
        this.configService.get<number>('JWT_EXPIRES_IN', 3600),
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      token_version: Date.now(),
      iat: Math.floor(Date.now() / 1000),
      exp:
        Math.floor(Date.now() / 1000) +
        this.configService.get<number>('REFRESH_TOKEN_EXPIRES_IN', 86400 * 7),
    };

    const accessToken = this.jwtService.sign(accessTokenPayload);
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });

    // Cache permissions in Redis
    await this.cachePermissions(user.id, hotelId, permissions);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<number>('JWT_EXPIRES_IN', 3600),
    };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub, status: UserStatus.ACTIVE },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserPermissions(
    user: PlatformUser,
    hotelId?: string,
  ): Promise<string[]> {
    const cacheKey = `permissions:${user.id}:${hotelId || 'platform'}`;

    // Try to get from cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get permissions from database
    let permissions: string[] = [];

    if (hotelId && user.role) {
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { role: { id: user.role.id } },
        relations: ['permission'],
      });
      permissions = rolePermissions.map((rp) => rp.permission.code);
    } else {
      // Platform scope permissions
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { role: { id: user.role?.id } },
        relations: ['permission'],
      });
      permissions = rolePermissions.map((rp) => rp.permission.code);
    }

    // Cache permissions
    await this.cachePermissions(user.id, hotelId, permissions);

    return permissions;
  }

  async cachePermissions(
    userId: string,
    hotelId: string | undefined,
    permissions: string[],
  ): Promise<void> {
    const cacheKey = `permissions:${userId}:${hotelId || 'platform'}`;
    const cacheTTL = this.configService.get<number>(
      'PERMISSIONS_CACHE_TTL',
      3600,
    );

    await this.redisService.set(
      cacheKey,
      JSON.stringify(permissions),
      cacheTTL,
    );
  }

  async clearUserPermissionsCache(userId: string): Promise<void> {
    const pattern = `permissions:${userId}:*`;
    const keys = await this.redisService.keys(pattern);

    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 12);
    return bcrypt.hash(password, saltRounds);
  }

  async comparePasswords(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
