import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
    private staffService: StaffService,
  ) {}

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
  ) {
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    let userId: string;
    let tempPassword: string | undefined;
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
    await this.accessRepository.save(access);

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

    return { userId, accessId: access.id, roleName: role.name, tempPassword };
  }

  async updateRole(accessId: string, hotelId: string, roleId: string) {
    const access = await this.accessRepository.findOne({
      where: { id: accessId, hotelId },
    });
    if (!access) throw new NotFoundException('Staff access record not found');

    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new BadRequestException('Role not found');

    access.roleId = roleId;
    await this.accessRepository.save(access);
    return { roleId, roleName: role.name };
  }

  async updateStatus(
    accessId: string,
    hotelId: string,
    status: HotelAccessStatus,
  ) {
    const access = await this.accessRepository.findOne({
      where: { id: accessId, hotelId },
    });
    if (!access) throw new NotFoundException('Staff access record not found');

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

    return { status };
  }

  async remove(accessId: string, hotelId: string) {
    const access = await this.accessRepository.findOne({
      where: { id: accessId, hotelId },
    });
    if (!access) throw new NotFoundException('Staff access record not found');

    access.status = HotelAccessStatus.INACTIVE;
    access.revokedAt = new Date();
    await this.accessRepository.save(access);
    await this.userRepository.update(access.userId, { isActive: false });

    return { deleted: true };
  }
}
