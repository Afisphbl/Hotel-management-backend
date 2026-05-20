import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';
import { PlatformUser } from './platform-user.entity';
import { Hotel } from './hotel.entity';
import { Role } from './role.entity';

export enum HotelAccessStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
}

@Entity('hotel_user_access')
export class HotelUserAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel, (hotel) => hotel.userAccesses)
  hotel: Hotel;

  @ManyToOne(() => Role)
  role: Role;

  @ManyToOne(() => PlatformUser)
  user: PlatformUser;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
