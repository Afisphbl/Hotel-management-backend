import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Permission } from '../../database/entities/permission.entity';
import { Role } from '../../database/entities/role.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { User } from '../../database/entities/user.entity';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionQueryDto,
  PermissionAssignmentDto,
  BulkPermissionAssignmentDto,
} from '../dto/permissions.dto';
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from '../../database/entities/audit-log.entity';
import { RedisService } from '../../modules/redis/redis.service';

const PREDEFINED_ROLES = [
  {
    name: 'SUPER_ADMIN',
    hierarchyLevel: 100,
    isSystemRole: true,
    description: 'Platform owner with full SaaS access',
  },
  {
    name: 'HOTEL_ADMIN',
    hierarchyLevel: 80,
    isSystemRole: true,
    description: 'Full access to hotel operations and staff management',
  },
  {
    name: 'ACCOUNTANT',
    hierarchyLevel: 50,
    isSystemRole: true,
    description: 'Finance, invoicing, and revenue operations',
  },
  {
    name: 'RECEPTIONIST',
    hierarchyLevel: 40,
    isSystemRole: true,
    description: 'Front desk, booking, and guest management',
  },
  {
    name: 'HOUSEKEEPING',
    hierarchyLevel: 30,
    isSystemRole: true,
    description: 'Room readiness and housekeeping operations',
  },
  {
    name: 'STAFF',
    hierarchyLevel: 20,
    isSystemRole: true,
    description: 'Base operational access for hotel staff',
  },
] as const;

const PREDEFINED_PERMISSION_SLUGS = [
  'hotels:create',
  'hotels:read',
  'hotels:update',
  'hotels:delete',
  'hotels:manage',
  'users:create',
  'users:read',
  'users:update',
  'users:delete',
  'users:manage',
  'bookings:create',
  'bookings:read',
  'bookings:update',
  'bookings:delete',
  'bookings:manage',
  'rooms:create',
  'rooms:read',
  'rooms:update',
  'rooms:delete',
  'rooms:manage',
  'guests:create',
  'guests:read',
  'guests:update',
  'guests:delete',
  'payments:create',
  'payments:read',
  'payments:update',
  'payments:delete',
  'payments:manage',
  'invoices:create',
  'invoices:read',
  'invoices:update',
  'invoices:delete',
  'invoices:manage',
  'staff:create',
  'staff:read',
  'staff:update',
  'staff:delete',
  'staff:manage',
  'shifts:create',
  'shifts:read',
  'shifts:update',
  'shifts:delete',
  'shifts:manage',
  'housekeeping:create',
  'housekeeping:read',
  'housekeeping:update',
  'housekeeping:delete',
  'housekeeping:manage',
  'maintenance:create',
  'maintenance:read',
  'maintenance:update',
  'maintenance:delete',
  'maintenance:manage',
  'finance:read',
  'finance:update',
  'finance:manage',
  'finance:admin',
  'reports:read',
  'reports:generate',
  'reports:manage',
  'config:read',
  'config:update',
  'config:manage',
  'platform:impersonate',
  'support:access',
  'roles:manage',
  'permissions:manage',
] as const;

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    const existingPermission = await this.permissionRepository.findOne({
      where: { slug: createPermissionDto.slug },
    });

    if (existingPermission) {
      throw new ConflictException(
        `Permission with code '${createPermissionDto.slug}' already exists`,
      );
    }

    const permission = this.permissionRepository.create({
      slug: createPermissionDto.slug,
      description: createPermissionDto.description,
    });

    const savedPermission = await this.permissionRepository.save(permission);

    await this.createAuditLog({
      action: AuditAction.CREATE,
      resourceType: AuditResource.PERMISSION,
      resourceId: savedPermission.id,
      newValues: savedPermission,
      description: `Created permission: ${savedPermission.slug}`,
      performedBy: 'system',
    });

    return savedPermission;
  }

  async findAll(query?: PermissionQueryDto): Promise<Permission[]> {
    return this.permissionRepository.find();
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }
    return permission;
  }

  async update(
    id: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<Permission> {
    const permission = await this.findOne(id);
    const oldValues = { ...permission };

    Object.assign(permission, updatePermissionDto);
    const updatedPermission = await this.permissionRepository.save(permission);

    await this.createAuditLog({
      action: AuditAction.UPDATE,
      resourceType: AuditResource.PERMISSION,
      resourceId: updatedPermission.id,
      oldValues,
      newValues: updatedPermission,
      description: `Updated permission: ${updatedPermission.slug}`,
      performedBy: 'system',
    });

    return updatedPermission;
  }

  async remove(id: string): Promise<void> {
    const permission = await this.findOne(id);
    const oldValues = { ...permission };

    await this.permissionRepository.softDelete(id);

    await this.createAuditLog({
      action: AuditAction.DELETE,
      resourceType: AuditResource.PERMISSION,
      resourceId: id,
      oldValues,
      description: `Deleted permission: ${permission.slug}`,
      performedBy: 'system',
    });
  }

  async assignPermission(
    assignmentDto: PermissionAssignmentDto,
  ): Promise<RolePermission> {
    const { roleId, permissionId } = assignmentDto;

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    await this.findOne(permissionId);

    const existingAssignment = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (existingAssignment) {
      throw new ConflictException(
        `Permission ${permissionId} is already assigned to role ${roleId}`,
      );
    }

    const savedAssignment = await this.rolePermissionRepository.save(
      this.rolePermissionRepository.create({ roleId, permissionId }),
    );
    await this.clearPermissionCachesFromRole(roleId);

    await this.createAuditLog({
      action: AuditAction.PERMISSION_GRANT,
      resourceType: AuditResource.PERMISSION,
      resourceId: permissionId,
      oldValues: { roleId },
      newValues: { roleId, permissionId },
      description: `Assigned permission ${permissionId} to role ${roleId}`,
      performedBy: 'system',
    });

    return savedAssignment;
  }

  async bulkAssignPermissions(
    bulkAssignmentDto: BulkPermissionAssignmentDto,
  ): Promise<RolePermission[]> {
    const { roleId, permissionIds } = bulkAssignmentDto;

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const permissions = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });
    if (permissions.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }

    await this.rolePermissionRepository.delete({ roleId });

    const assignments = await this.rolePermissionRepository.save(
      permissionIds.map((permissionId) =>
        this.rolePermissionRepository.create({ roleId, permissionId }),
      ),
    );
    await this.clearPermissionCachesFromRole(roleId);

    await this.createAuditLog({
      action: AuditAction.PERMISSION_GRANT,
      resourceType: AuditResource.PERMISSION,
      resourceId: roleId,
      oldValues: { roleId, oldPermissions: permissionIds },
      newValues: { roleId, newPermissions: permissionIds },
      description: `Bulk assigned ${permissionIds.length} permissions to role ${roleId}`,
      performedBy: 'system',
    });

    return assignments;
  }

  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    const rolePermission = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (!rolePermission) {
      throw new NotFoundException(
        `Permission ${permissionId} is not assigned to role ${roleId}`,
      );
    }

    const oldValues = { ...rolePermission };

    await this.rolePermissionRepository.delete({ roleId, permissionId });
    await this.clearPermissionCachesFromRole(roleId);

    await this.createAuditLog({
      action: AuditAction.PERMISSION_REVOKE,
      resourceType: AuditResource.PERMISSION,
      resourceId: permissionId,
      oldValues,
      description: `Revoked permission ${permissionId} from role ${roleId}`,
      performedBy: 'system',
    });
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    return this.getInheritedRolePermissions(roleId);
  }

  async getRolePermissionSlugs(roleId: string): Promise<string[]> {
    const permissions = await this.getRolePermissions(roleId);
    return permissions.map((p) => p.slug);
  }

  async getUserPermissions(
    userId: string,
    hotelId?: string,
  ): Promise<string[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.roleId) {
      return [];
    }

    return this.getRolePermissionSlugs(user.roleId);
  }

  async createPredefinedPermissions(): Promise<Permission[]> {
    const existingPermissions = await this.permissionRepository.find();
    const existingCodes = new Set(
      existingPermissions.map((permission) => permission.slug),
    );
    const newPermissions = PREDEFINED_PERMISSION_SLUGS.filter(
      (permission) => !existingCodes.has(permission),
    );

    if (newPermissions.length > 0) {
      return this.permissionRepository.save(
        this.permissionRepository.create(
          newPermissions.map((permission) => ({
            slug: permission,
            description: permission,
          })),
        ),
      );
    }

    return [];
  }

  async getPredefinedRoles(): Promise<
    Array<(typeof PREDEFINED_ROLES)[number]>
  > {
    return [...PREDEFINED_ROLES];
  }

  async createPredefinedRoles(): Promise<Role[]> {
    const existingRoles = await this.roleRepository.find();
    const existingByName = new Map(
      existingRoles.map((role) => [role.name, role]),
    );
    const rolesToSave = PREDEFINED_ROLES.map((definition) => {
      const role =
        existingByName.get(definition.name) ??
        this.roleRepository.create({ name: definition.name });

      role.description = definition.description;
      role.isSystemRole = definition.isSystemRole;
      role.hierarchyLevel = definition.hierarchyLevel;

      return role;
    });

    const savedRoles = await this.roleRepository.save(rolesToSave);
    await this.clearPermissionCachesForRoleChanges(savedRoles);
    return savedRoles;
  }

  async bootstrapPredefinedAccessControl(): Promise<{
    roles: Role[];
    permissions: Permission[];
  }> {
    const permissions = await this.createPredefinedPermissions();
    const roles = await this.createPredefinedRoles();
    await this.seedRolePermissionHierarchy();
    return { roles, permissions };
  }

  private async createAuditLog(data: {
    action: AuditAction;
    resourceType: AuditResource;
    resourceId?: string;
    oldValues?: any;
    newValues?: any;
    description?: string;
    performedBy: string;
  }) {
    const auditLog = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(auditLog);
  }

  private async getInheritedRolePermissions(
    roleId: string,
  ): Promise<Permission[]> {
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

    const permissionIds = [
      ...new Set(rolePermissions.map((rp) => rp.permissionId)),
    ];
    if (permissionIds.length === 0) {
      return [];
    }

    return this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });
  }

  private async seedRolePermissionHierarchy(): Promise<void> {
    const [roles, permissions] = await Promise.all([
      this.roleRepository.find(),
      this.permissionRepository.find(),
    ]);

    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const permissionBySlug = new Map(
      permissions.map((permission) => [permission.slug, permission]),
    );

    const grants: Record<string, string[]> = {
      STAFF: ['bookings:read', 'rooms:read', 'guests:read'],
      HOUSEKEEPING: [
        'housekeeping:read',
        'housekeeping:update',
        'rooms:read',
        'rooms:update',
      ],
      RECEPTIONIST: [
        'bookings:create',
        'bookings:read',
        'bookings:update',
        'guests:create',
        'guests:read',
        'guests:update',
        'rooms:read',
        'payments:read',
      ],
      ACCOUNTANT: [
        'finance:read',
        'finance:update',
        'invoices:read',
        'invoices:update',
        'payments:read',
        'payments:update',
        'reports:read',
      ],
      HOTEL_ADMIN: [
        'hotels:read',
        'hotels:update',
        'users:manage',
        'rooms:manage',
        'bookings:manage',
        'staff:manage',
        'finance:read',
        'finance:manage',
        'config:manage',
        'reports:manage',
      ],
      SUPER_ADMIN: [
        'platform:impersonate',
        'support:access',
        'roles:manage',
        'permissions:manage',
      ],
    };

    const rolePermissions = new Map<string, string[]>();
    for (const [roleName, slugs] of Object.entries(grants)) {
      const role = roleByName.get(roleName);
      if (!role) {
        continue;
      }

      rolePermissions.set(
        role.id,
        slugs.filter((slug) => permissionBySlug.has(slug)),
      );
    }

    const existingAssignments = await this.rolePermissionRepository.find();
    const existingKeys = new Set(
      existingAssignments.map(
        (assignment) => `${assignment.roleId}:${assignment.permissionId}`,
      ),
    );

    const assignments = Array.from(rolePermissions.entries()).flatMap(
      ([roleId, slugs]) =>
        slugs
          .map((slug) => permissionBySlug.get(slug))
          .filter((permission): permission is Permission => Boolean(permission))
          .filter(
            (permission) => !existingKeys.has(`${roleId}:${permission.id}`),
          )
          .map((permission) =>
            this.rolePermissionRepository.create({
              roleId,
              permissionId: permission.id,
            }),
          ),
    );

    if (assignments.length > 0) {
      await this.rolePermissionRepository.save(assignments);
    }
  }

  private async clearPermissionCachesForRoleChanges(
    roles: Role[],
  ): Promise<void> {
    const roleIds = roles.map((role) => role.id);
    if (roleIds.length === 0) {
      return;
    }

    const affectedUsers = await this.userRepository.find({
      where: { roleId: In(roleIds) },
      select: ['id'],
    });

    await Promise.all(
      affectedUsers.map((user) => this.clearUserPermissionsCache(user.id)),
    );
  }

  private async clearPermissionCachesFromRole(roleId: string): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) {
      return;
    }

    const affectedRoles = await this.roleRepository
      .createQueryBuilder('role')
      .select(['role.id'])
      .where('role.hierarchyLevel >= :level', { level: role.hierarchyLevel })
      .getMany();

    const affectedRoleIds = affectedRoles.map((item) => item.id);
    if (affectedRoleIds.length === 0) {
      return;
    }

    const affectedUsers = await this.userRepository.find({
      where: { roleId: In(affectedRoleIds) },
      select: ['id'],
    });

    await Promise.all(
      affectedUsers.map((user) => this.clearUserPermissionsCache(user.id)),
    );
  }

  private async clearUserPermissionsCache(userId: string): Promise<void> {
    const patterns = [`permissions:${userId}:*`, `permission:${userId}:*`];

    for (const pattern of patterns) {
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }
    }
  }
}
