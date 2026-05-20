import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum DelegatedAdminStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity({ name: 'delegated_admins', schema: 'global' })
@Index(['delegateUserId', 'delegatorUserId', 'hotelId'])
@Index(['hotelId', 'status'])
export class DelegatedAdmin extends BaseEntity {
  @Column()
  delegateUserId: string;

  @Column({ type: 'varchar', length: 255 })
  delegateEmail: string;

  @Column()
  delegatorUserId: string;

  @Column({ type: 'varchar', length: 255 })
  delegatorEmail: string;

  @Column()
  hotelId: string;

  @Column({ type: 'varchar', length: 255 })
  hotelName: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: DelegatedAdminStatus,
    default: DelegatedAdminStatus.ACTIVE,
  })
  status: DelegatedAdminStatus;

  @Column({ type: 'jsonb' })
  delegatedPermissions: string[];

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  revocationReason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
