import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum HotelStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity({ name: 'hotels', schema: 'global' })
export class Hotel extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  schemaName: string;

  @Column({
    type: 'enum',
    enum: HotelStatus,
    default: HotelStatus.ACTIVE,
  })
  status: HotelStatus;

  @Column({ nullable: true })
  subdomain: string;
}
