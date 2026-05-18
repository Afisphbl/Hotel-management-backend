import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, HotelUserAccess, Role, Permission, RolePermission])],
  exports: [TypeOrmModule],
})
export class UsersModule {}
