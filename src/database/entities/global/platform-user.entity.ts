import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';
import { Role } from './role.entity';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  HOTEL_ADMIN = 'HOTEL_ADMIN',
  HOTEL_OWNER = 'HOTEL_OWNER',
  HOTEL_MANAGER = 'HOTEL_MANAGER',
  REVENUE_MANAGER = 'REVENUE_MANAGER',
  FRONT_DESK = 'FRONT_DESK',
  ACCOUNTANT = 'ACCOUNTANT',
  HOUSEKEEPING_SUPERVISOR = 'HOUSEKEEPING_SUPERVISOR',
  HOUSEKEEPING_STAFF = 'HOUSEKEEPING_STAFF',
  MAINTENANCE_STAFF = 'MAINTENANCE_STAFF',
}

@Entity({ name: 'platform_users', schema: 'global' })
export class PlatformUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  loginHistory: Array<{
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastFailedLoginAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastFailedLoginIp: string | null;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lockedBy: string | null;

  @Column({ type: 'text', nullable: true })
  lockReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastPasswordChangeAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  passwordHistory: string[];

  @Column({ type: 'boolean', default: false })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  deactivatedBy: string | null;

  @Column({ type: 'text', nullable: true })
  deactivationReason: string | null;

  @ManyToOne(() => Role)
  role: Role;
}
