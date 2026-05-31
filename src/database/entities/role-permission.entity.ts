import {
  Entity,
  Column,
  Unique,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from './global/role.entity';
import { Permission } from './global/permission.entity';

@Entity({ name: 'role_permissions', schema: 'global' })
@Unique(['roleId', 'permissionId'])
export class RolePermission extends BaseEntity {
  @Column({ nullable: true })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  @Index()
  role: Role;

  @Column({ nullable: true })
  permissionId: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId' })
  @Index()
  permission: Permission;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  grantedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  grantedBy: string;
}
