import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum HotelAccessStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

@Entity({ name: 'hotel_user_access', schema: 'global' })
@Unique(['userId', 'hotelId'])
export class HotelUserAccess extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  hotelId: string;

  @Column({ nullable: true })
  roleId: string;

  @Column({ type: 'timestamptz' })
  grantedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedAt: Date | null;

  @Column({
    type: 'enum',
    enum: HotelAccessStatus,
    default: HotelAccessStatus.ACTIVE,
  })
  status: HotelAccessStatus;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;
}
