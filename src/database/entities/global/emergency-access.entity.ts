import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum EmergencyAccessStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum EmergencyAccessPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity({ name: 'emergency_access', schema: 'global' })
@Index(['requestedBy', 'status'])
@Index(['hotelId', 'status'])
export class EmergencyAccess extends BaseEntity {
  @Column()
  requestedBy: string;

  @Column({ type: 'varchar', length: 255 })
  requesterEmail: string;

  @Column()
  hotelId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hotelName: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: EmergencyAccessPriority,
    default: EmergencyAccessPriority.MEDIUM,
  })
  priority: EmergencyAccessPriority;

  @Column({
    type: 'enum',
    enum: EmergencyAccessStatus,
    default: EmergencyAccessStatus.REQUESTED,
  })
  status: EmergencyAccessStatus;

  @Column({ type: 'text', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  approverEmail: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  accessedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  revocationReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
