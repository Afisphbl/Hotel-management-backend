import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum ImpersonationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REVOKED = 'revoked',
}

@Entity({ name: 'impersonation_logs', schema: 'global' })
@Index(['impersonatorId', 'startedAt'])
@Index(['targetUserId', 'startedAt'])
export class ImpersonationLog extends BaseEntity {
  @Column()
  impersonatorId: string;

  @Column({ type: 'varchar', length: 255 })
  impersonatorEmail: string;

  @Column({ nullable: true })
  targetUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetUserEmail: string | null;

  @Column({ nullable: true })
  targetHotelId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetHotelName: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: ImpersonationStatus,
    default: ImpersonationStatus.ACTIVE,
  })
  status: ImpersonationStatus;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
