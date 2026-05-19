import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany, OneToOne, ManyToOne } from 'typeorm';
import { RolePermission } from './role-permission.entity';
import { Role } from './role.entity';
import { HotelUserAccess } from './hotel-user-access.entity';
import { AuditLog } from './audit-log.entity';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  HOTEL_OWNER = 'HOTEL_OWNER',
  HOTEL_MANAGER = 'HOTEL_MANAGER',
  REVENUE_MANAGER = 'REVENUE_MANAGER',
  FRONT_DESK = 'FRONT_DESK',
  ACCOUNTANT = 'ACCOUNTANT',
  HOUSEKEEPING_SUPERVISOR = 'HOUSEKEEPING_SUPERVISOR',
  HOUSEKEEPING_STAFF = 'HOUSEKEEPING_STAFF',
  MAINTENANCE_STAFF = 'MAINTENANCE_STAFF',
}

@Entity('platform_users')
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

  @ManyToOne(() => Role)
  role: Role;

  @OneToMany(() => HotelUserAccess, access => access.user)
  hotelAccesses: HotelUserAccess[];

  @OneToMany(() => AuditLog, audit => audit.user)
  auditLogs: AuditLog[];
}