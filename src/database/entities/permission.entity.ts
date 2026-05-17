import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'permissions', schema: 'global' })
export class Permission extends BaseEntity {
  @Column({ unique: true })
  slug: string; // e.g., 'rooms:read', 'bookings:create'

  @Column({ nullable: true })
  description: string;
}
