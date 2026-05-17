import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'roles', schema: 'global' })
export class Role extends BaseEntity {
  @Column({ unique: true })
  name: string; // e.g., 'FRONT_DESK', 'SUPER_ADMIN'

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isSystemRole: boolean;
}
