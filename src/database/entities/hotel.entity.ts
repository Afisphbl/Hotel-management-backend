import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum HotelStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum HotelType {
  BOUTIQUE = 'BOUTIQUE',
  CHAIN = 'CHAIN',
  RESORT = 'RESORT',
  MOTEL = 'MOTEL',
  LUXURY = 'LUXURY',
}

@Entity({ name: 'hotels', schema: 'global' })
export class Hotel extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'enum', enum: HotelType, default: HotelType.BOUTIQUE })
  type: HotelType;

  @Column({ unique: true, nullable: true })
  schemaName: string;

  @Column({
    type: 'enum',
    enum: HotelStatus,
    default: HotelStatus.ACTIVE,
  })
  status: HotelStatus;

  @Column({ nullable: true })
  subdomain: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  timezone: string;

  @Column({ nullable: true })
  currency: string;

  @Column({ nullable: true })
  ownerName: string;

  @Column({ nullable: true })
  ownerEmail: string;

  @Column({ type: 'integer', default: 0 })
  storageUsedMb: number;

  @Column({ type: 'integer', default: 120 })
  rooms: number;

  @Column({ default: false })
  maintenanceMode: boolean;
}
