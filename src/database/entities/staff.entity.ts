import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum StaffRole {
  HOUSEKEEPING_STAFF = 'housekeeping_staff',
  MAINTENANCE_STAFF = 'maintenance_staff',
  FRONT_DESK = 'front_desk',
  HOUSEKEEPING_SUPERVISOR = 'housekeeping_supervisor',
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
}

export enum StaffStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  TERMINATED = 'terminated',
}

@Entity({ name: 'staff' })
@Index(['email'])
@Index(['role'])
@Index(['status'])
export class Staff extends BaseEntity {
  @Column()
  userId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: StaffRole,
  })
  role: StaffRole;

  @Column({
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({
    type: 'enum',
    enum: StaffStatus,
    default: StaffStatus.ACTIVE,
  })
  status: StaffStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  hourlyRate: number;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  joinedAt: Date;
}
