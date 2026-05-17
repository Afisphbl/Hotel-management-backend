import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'role_permissions', schema: 'public' })
@Unique(['roleId', 'permissionId'])
export class RolePermission extends BaseEntity {
  @Column()
  roleId: string;

  @Column()
  permissionId: string;
}
