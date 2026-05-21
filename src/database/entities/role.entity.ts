import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum RoleScope {
  PLATFORM = 'PLATFORM',
  HOTEL = 'HOTEL',
}

@Entity({ name: 'roles', schema: 'global' })
export class Role extends BaseEntity {
  @Column({ unique: true })
  name: string; // e.g., 'FRONT_DESK', 'SUPER_ADMIN'

  @Column({ type: 'enum', enum: RoleScope })
  scope: RoleScope;

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isSystemRole: boolean;

  @Column({ type: 'integer', default: 0 })
  hierarchyLevel: number; // Higher number = higher authority
}
