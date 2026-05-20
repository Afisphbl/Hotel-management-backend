import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum ConsentType {
  MARKETING_EMAILS = 'marketing_emails',
  DATA_PROCESSING = 'data_processing',
  THIRD_PARTY_SHARING = 'third_party_sharing',
  COOKIES_ANALYTICS = 'cookies_analytics',
  COMMUNICATION = 'communication',
  TERMS_OF_SERVICE = 'terms_of_service',
  PRIVACY_POLICY = 'privacy_policy',
}

export enum ConsentStatus {
  GRANTED = 'granted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity({ name: 'consent_records', schema: 'global' })
@Index(['userId', 'type'])
@Index(['hotelId'])
@Index(['expiresAt'])
export class ConsentRecord extends BaseEntity {
  @Column()
  userId: string;

  @Column({ nullable: true })
  hotelId: string;

  @Column({ type: 'enum', enum: ConsentType })
  type: ConsentType;

  @Column({ type: 'enum', enum: ConsentStatus, default: ConsentStatus.GRANTED })
  status: ConsentStatus;

  @Column({ type: 'text', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'timestamptz', nullable: true })
  grantedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @Column({ type: 'text', nullable: true })
  policyVersion: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
