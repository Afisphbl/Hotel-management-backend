import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { HotelUserAccess } from './hotel-user-access.entity';

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

@Entity('hotels')
export class Hotel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: HotelType })
  type: HotelType;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  city: string;

  @Column({ type: 'text', nullable: true })
  state: string;

  @Column({ type: 'text', nullable: true })
  country: string;

  @Column({ type: 'text', nullable: true })
  postalCode: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  website: string;

  @Column({ type: 'text', nullable: true })
  logoUrl: string;

  @Column({ type: 'text', nullable: true })
  bannerUrl: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  baseCurrency: string;

  @Column({ type: 'text', nullable: true })
  timezone: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @Column({ type: 'enum', enum: HotelStatus, default: HotelStatus.ACTIVE })
  status: HotelStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => HotelUserAccess, access => access.hotel)
  userAccesses: HotelUserAccess[];
}