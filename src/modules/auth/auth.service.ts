import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Permission } from '../../database/entities/permission.entity';
import * as bcrypt from 'bcrypt';

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
    private jwtService: JwtService,
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

  async login(user: any, hotelId?: string) {
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
      role: roleName, // Simplified for now
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
