import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @Index()
  role: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @Index()
  permission: Permission;

  @Column({ type: 'timestamptz' })
  grantedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  grantedBy: string;
}
