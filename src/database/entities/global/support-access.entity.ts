import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum SupportAccessStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity({ name: 'support_access', schema: 'global' })
@Index(['platformUserId', 'hotelId', 'status'])
export class SupportAccess extends BaseEntity {
  @Column()
  platformUserId: string;

  @Column()
  hotelId: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: SupportAccessStatus,
    default: SupportAccessStatus.ACTIVE,
  })
  status: SupportAccessStatus;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
