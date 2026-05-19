import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PlatformUser,
  Role,
  Permission,
  RolePermission,
  HotelUserAccess,
  UserStatus,
} from '../../database/entities/global';
import { RedisService } from '../../modules/redis/redis.service';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(PlatformUser)
    private readonly userRepository: Repository<PlatformUser>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(HotelUserAccess)
    private readonly hotelUserAccessRepository: Repository<HotelUserAccess>,
    private readonly redisService: RedisService,
  ) {}

  async hasPermission(
    userId: string,
    permission: string,
    hotelId?: string,
  ): Promise<boolean> {
    const cacheKey = `permission:${userId}:${permission}:${hotelId || 'platform'}`;

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached !== null) {
      return cached === 'true';
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['hotelAccesses', 'role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let hasPermission = false;

    if (hotelId) {
      // Check hotel-specific permissions
      const hotelAccess = user.hotelAccesses?.find(
        (access) => access.hotelId === hotelId && access.status === 'ACTIVE',
      );

      if (hotelAccess?.permissions?.includes(permission)) {
        hasPermission = true;
      } else {
        // Check role permissions
        const rolePermissions = await this.rolePermissionRepository.find({
          where: { role: { id: hotelAccess?.role?.id } },
          relations: ['permission'],
        });
        hasPermission = rolePermissions.some(
          (rp) => rp.permission.code === permission,
        );
      }
    } else {
      // Check platform permissions
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { role: { id: user.role?.id } },
        relations: ['permission'],
      });
      hasPermission = rolePermissions.some(
        (rp) => rp.permission.code === permission,
      );
    }

    // Cache result
    const cacheTTL = 300; // 5 minutes
    await this.redisService.set(cacheKey, hasPermission.toString(), cacheTTL);

    return hasPermission;
  }

  async grantRolePermission(
    roleId: string,
    permissionId: string,
    grantedBy: string,
  ): Promise<RolePermission> {
    // Check if already exists
    const existing = await this.rolePermissionRepository.findOne({
      where: { role: { id: roleId }, permission: { id: permissionId } },
    });

    if (existing) {
      return existing;
    }

    const rolePermission = this.rolePermissionRepository.create({
      role: { id: roleId } as Role,
      permission: { id: permissionId } as Permission,
      grantedAt: new Date(),
      grantedBy,
    });

    return this.rolePermissionRepository.save(rolePermission);
  }

  async revokeRolePermission(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.rolePermissionRepository.delete({
      role: { id: roleId },
      permission: { id: permissionId },
    });
  }

  async createUserRole(userId: string, roleId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = { id: roleId } as Role;
    await this.userRepository.save(user);

    // Clear user permissions cache
    await this.clearUserPermissionsCache(userId);
  }

  async assignHotelPermissions(
    userId: string,
    hotelId: string,
    permissions: string[],
  ): Promise<HotelUserAccess> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let access = await this.hotelUserAccessRepository.findOne({
      where: { user: { id: userId }, hotelId },
    });

    if (!access) {
      access = this.hotelUserAccessRepository.create({
        user,
        hotelId,
        grantedAt: new Date(),
        permissions,
      });
    } else {
      access.permissions = permissions;
      access.updatedAt = new Date();
    }

    return this.hotelUserAccessRepository.save(access);
  }

  async clearUserPermissionsCache(userId: string): Promise<void> {
    const patterns = [`permissions:${userId}:*`, `permission:${userId}:*`];

    for (const pattern of patterns) {
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
    }
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { role: { id: roleId } },
      relations: ['permission'],
    });

    return rolePermissions.map((rp) => rp.permission);
  }

  async getUserPermissions(
    userId: string,
    hotelId?: string,
  ): Promise<string[]> {
    const cacheKey = `permissions:${userId}:${hotelId || 'platform'}`;

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['hotelAccesses', 'role'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let permissions: string[] = [];

    if (hotelId) {
      const hotelAccess = user.hotelAccesses?.find(
        (access) => access.hotelId === hotelId && access.status === 'ACTIVE',
      );

      if (hotelAccess?.permissions) {
        permissions = hotelAccess.permissions;
      } else {
        const rolePermissions = await this.rolePermissionRepository.find({
          where: { role: { id: hotelAccess?.role?.id } },
          relations: ['permission'],
        });
        permissions = rolePermissions.map((rp) => rp.permission.code);
      }
    } else {
      const rolePermissions = await this.rolePermissionRepository.find({
        where: { role: { id: user.role?.id } },
        relations: ['permission'],
      });
      permissions = rolePermissions.map((rp) => rp.permission.code);
    }

    // Cache result
    const cacheTTL = 3600; // 1 hour
    await this.redisService.set(
      cacheKey,
      JSON.stringify(permissions),
      cacheTTL,
    );

    return permissions;
  }
}
