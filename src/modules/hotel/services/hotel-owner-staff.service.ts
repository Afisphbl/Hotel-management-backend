import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import {
  HotelUserAccess,
  HotelAccessStatus,
} from '../../../database/entities/hotel-user-access.entity';
import { Role } from '../../../database/entities/role.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';
import { Permission } from '../../../database/entities/permission.entity';
import { AuditLog, AuditAction, AuditResource } from '../../../database/entities/audit-log.entity';
import * as bcrypt from 'bcrypt';
import { StaffService } from './staff.service';
import { StaffRole } from '../../../database/entities/staff.entity';

@Injectable()
export class HotelOwnerStaffService {
  private readonly logger = new Logger(HotelOwnerStaffService.name);

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
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private staffService: StaffService,
  ) {}

  private async logAudit(
    action: AuditAction,
    resourceType: AuditResource,
    resourceId: string,
    performedBy: string,
    hotelId: string,
    oldValues?: any,
    newValues?: any,
    description?: string,
  ) {
    const auditLog = this.auditLogRepository.create({
      userId: performedBy,
      hotelId,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      description,
      performedBy,
      metadata: {} as any,
    });
    await this.auditLogRepository.save(auditLog);
  }

  async findAll(
    hotelId: string,
    options: { page?: number; limit?: number; status?: string },
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { hotelId };
    if (options.status) {
      where.status = options.status;
    }

    const [accessRecords, total] = await this.accessRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { grantedAt: 'DESC' },
    });

    const userIds = accessRecords.map((a) => a.userId);
    const users = userIds.length
      ? await this.userRepository.find({
          where: { id: In(userIds) },
          relations: ['role'],
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const roleIds = [
      ...new Set(accessRecords.map((a) => a.roleId).filter(Boolean)),
    ];
    const roles = roleIds.length
      ? await this.roleRepository.find({ where: { id: In(roleIds) } })
      : [];
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    const items = accessRecords.map((access) => {
      const user = userMap.get(access.userId);
      const role = access.roleId ? roleMap.get(access.roleId) : null;
      return {
        id: access.id,
        userId: access.userId,
        email: user?.email || null,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        isActive: user?.isActive ?? true,
        roleId: access.roleId,
        roleName: role?.name || null,
        roleDescription: role?.description || null,
        status: access.status,
        grantedAt: access.grantedAt,
        lastAccessedAt: access.lastAccessedAt,
        notes: access.notes,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAvailableRoles(hotelId: string) {
    return this.roleRepository.find({
      where: { scope: 'HOTEL' as any },
      order: { name: 'ASC' },
    });
  }

  async getSummary(hotelId: string) {
    const allAccess = await this.accessRepository.find({ where: { hotelId } });
    const total = allAccess.length;
    const active = allAccess.filter(
      (a) => a.status === HotelAccessStatus.ACTIVE,
    ).length;
    const pending = allAccess.filter(
      (a) => a.status === HotelAccessStatus.PENDING,
    ).length;
    const inactive = allAccess.filter(
      (a) => a.status === HotelAccessStatus.INACTIVE,
    ).length;

    const roleIds = [
      ...new Set(allAccess.map((a) => a.roleId).filter(Boolean)),
    ];
    const roles = roleIds.length
      ? await this.roleRepository.find({ where: { id: In(roleIds) } })
      : [];

    const distribution = roles.map((role) => ({
      roleId: role.id,
      roleName: role.name,
      count: allAccess.filter((a) => a.roleId === role.id).length,
    }));

    return { total, active, pending, inactive, distribution };
  }

  async invite(
    hotelId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      roleId: string;
      notes?: string;
    },
    performedBy?: string,
    requesterRole?: string,
  ) {
    // Protection: Admin cannot invite someone as an owner
    if (requesterRole === 'HOTEL_ADMIN') {
      const targetRole = await this.roleRepository.findOne({
        where: { id: data.roleId },
      });
      if (targetRole?.name === 'HOTEL_OWNER') {
        throw new ForbiddenException('Admins cannot invite users with the Owner role');
      }
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    let userId: string;
    let tempPassword: string | undefined;
    const oldValues = { email: data.email };
    
    if (existingUser) {
      const existingAccess = await this.accessRepository.findOne({
        where: { userId: existingUser.id, hotelId },
      });
      if (existingAccess) {
        throw new BadRequestException('User already has access to this hotel');
      }
      userId = existingUser.id;
    } else {
      tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const user = this.userRepository.create({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        scope: 'hotel' as any,
        isActive: true,
        roleId: data.roleId,
      });
      const saved = await this.userRepository.save(user);
      userId = saved.id;
    }

    const role = await this.roleRepository.findOne({
      where: { id: data.roleId },
    });
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    const access = this.accessRepository.create({
      userId,
      hotelId,
      roleId: data.roleId,
      grantedAt: new Date(),
      status: HotelAccessStatus.ACTIVE,
      notes: data.notes || undefined,
    });
    const savedAccess = await this.accessRepository.save(access);

    // Sync to tenant-specific staff table
    try {
      // Map system roles to StaffRole enum if possible
      let staffRole = StaffRole.FRONT_DESK;
      const roleName = role.name.toLowerCase();
      if (roleName.includes('housekeeping')) {
        staffRole = roleName.includes('supervisor')
          ? StaffRole.HOUSEKEEPING_SUPERVISOR
          : StaffRole.HOUSEKEEPING_STAFF;
      } else if (roleName.includes('maintenance')) {
        staffRole = StaffRole.MAINTENANCE_STAFF;
      }

      await this.staffService.create(
        {
          userId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: staffRole,
          status: 'active',
        },
        hotelId,
      );
    } catch (e) {
      this.logger.error(`Failed to sync staff to tenant schema: ${e.message}`);
      // Don't fail the whole invite if sync fails (schema might not be ready)
    }

    // Log the invite action
    await this.logAudit(
      AuditAction.PERMISSION_GRANT,
      AuditResource.USER,
      userId,
      performedBy || 'system',
      hotelId,
      oldValues,
      {
        userId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        roleId: data.roleId,
        roleName: role.name,
        accessId: savedAccess.id,
      },
      `Invited staff member ${data.firstName} ${data.lastName} (${data.email}) with role ${role.name}`
    );

    return { userId, accessId: savedAccess.id, roleName: role.name, tempPassword };
  }

  async updateRole(
    accessId: string,
    hotelId: string,
    roleId: string,
    performedBy?: string,
    requesterRole?: string,
  ) {
    const access = await this.accessRepository.findOne({
      where: { id: accessId, hotelId },
    });
    if (!access) throw new NotFoundException('Staff access record not found');

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new BadRequestException('Role not found');

    // Protection: Admin cannot change the role of another admin or owner
    if (requesterRole === 'HOTEL_ADMIN') {
      const targetUser = await this.userRepository.findOne({
        where: { id: access.userId },
        relations: ['role'],
      });
      const targetRoleName = targetUser?.role?.name || '';
      if (targetRoleName === 'HOTEL_ADMIN' || targetRoleName === 'HOTEL_OWNER') {
        throw new ForbiddenException('Admins cannot change the role of other admins or owners');
      }
      
      // Also prevent admin from promoting someone to owner
      if (role.name === 'HOTEL_OWNER') {
        throw new ForbiddenException('Admins cannot promote staff to the Owner role');
      }
    }

    const oldValues = { roleId: access.roleId };
    access.roleId = roleId;
    const savedAccess = await this.accessRepository.save(access);
    
    // Log the role change action
    await this.logAudit(
      AuditAction.UPDATE,
      AuditResource.USER,
      access.userId,
      performedBy || 'system',
      hotelId,
      oldValues,
      { roleId, roleName: role.name },
      `Changed role for staff member ${access.userId} from ${oldValues.roleId} to ${roleId}`
    );

    return { roleId, roleName: role.name };
  }

  async updateStatus(
    accessId: string,
    hotelId: string,
    status: HotelAccessStatus,
    performedBy?: string,
    requesterRole?: string,
  ) {
    const access = await this.accessRepository.findOne({
      where: { id: accessId, hotelId },
    });
    if (!access) throw new NotFoundException('Staff access record not found');

    // Protection: Admin cannot change status of another admin or owner
    if (requesterRole === 'HOTEL_ADMIN') {
      const targetUser = await this.userRepository.findOne({
        where: { id: access.userId },
        relations: ['role'],
      });
      const targetRoleName = targetUser?.role?.name || '';
      if (targetRoleName === 'HOTEL_ADMIN' || targetRoleName === 'HOTEL_OWNER') {
        throw new ForbiddenException('Admins cannot change the status of other admins or owners');
      }
    }

    const oldValues = { status: access.status, revokedAt: access.revokedAt };
    access.status = status;
    if (status === HotelAccessStatus.INACTIVE) {
      access.revokedAt = new Date();
    }
    await this.accessRepository.save(access);

    if (status === HotelAccessStatus.INACTIVE) {
      await this.userRepository.update(access.userId, { isActive: false });
    } else if (status === HotelAccessStatus.ACTIVE) {
      await this.userRepository.update(access.userId, { isActive: true });
    }

    // Log the status change action
    await this.logAudit(
      status === HotelAccessStatus.INACTIVE ? AuditAction.DELETE : AuditAction.UPDATE,
      AuditResource.USER,
      access.userId,
      performedBy || 'system',
      hotelId,
      oldValues,
      { status, revokedAt: status === HotelAccessStatus.INACTIVE ? new Date() : null },
      `Changed status for staff member ${access.userId} from ${oldValues.status} to ${status}`
    );

    return { status };
  }

  async remove(
    accessId: string,
    hotelId: string,
    performedBy?: string,
    requesterRole?: string,
  ) {
    const access = await this.accessRepository.findOne({
      where: { id: accessId, hotelId },
    });
    if (!access) throw new NotFoundException('Staff access record not found');

    // Protection: Admin cannot remove another admin or owner
    if (requesterRole === 'HOTEL_ADMIN') {
      const targetUser = await this.userRepository.findOne({
        where: { id: access.userId },
        relations: ['role'],
      });
      const targetRoleName = targetUser?.role?.name || '';
      if (targetRoleName === 'HOTEL_ADMIN' || targetRoleName === 'HOTEL_OWNER') {
        throw new ForbiddenException('Admins cannot remove other admins or owners');
      }
    }

    const oldValues = { status: access.status, revokedAt: access.revokedAt };
    access.status = HotelAccessStatus.INACTIVE;
    access.revokedAt = new Date();
    await this.accessRepository.save(access);
    await this.userRepository.update(access.userId, { isActive: false });

    // Log the removal action
    await this.logAudit(
      AuditAction.DELETE,
      AuditResource.USER,
      access.userId,
      performedBy || 'system',
      hotelId,
      oldValues,
      { status: HotelAccessStatus.INACTIVE, revokedAt: access.revokedAt },
      `Revoked staff access for user ${access.userId}`
    );

    return { deleted: true };
  }
}
