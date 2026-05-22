import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'permissions', schema: 'global' })
export class Permission extends BaseEntity {
  @Column()
  name: string; // e.g., 'Rooms Read'

  @Column({ unique: true })
  code: string; // e.g., 'rooms:read'

  @Column({ unique: true, nullable: true })
  slug: string; // e.g., 'rooms:read'

  @Column({ nullable: true })
  description: string;
}
