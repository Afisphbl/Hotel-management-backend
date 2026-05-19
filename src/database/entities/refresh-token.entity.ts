import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum RefreshTokenStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity({ name: 'refresh_tokens', schema: 'global' })
@Index(['userId', 'status'])
export class RefreshToken extends BaseEntity {
  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  token: string;

  @Column({ nullable: true, type: 'varchar' })
  hotelId: string | null;

  @Column({ default: 'hmac-sha256' })
  tokenHashAlgorithm: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: RefreshTokenStatus,
    default: RefreshTokenStatus.ACTIVE,
  })
  status: RefreshTokenStatus;

  @Column({ nullable: true })
  revokedAt: Date;

  @Column({ nullable: true })
  revokedBy: string; // userId who revoked

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    device?: string;
  };
}
