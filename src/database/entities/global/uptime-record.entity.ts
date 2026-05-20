import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum UptimeStatus {
  UP = 'up',
  DEGRADED = 'degraded',
  DOWN = 'down',
}

@Entity({ name: 'uptime_records', schema: 'global' })
@Index(['component', 'recordedAt'])
@Index(['status', 'recordedAt'])
export class UptimeRecord extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  component: string;

  @Column({
    type: 'enum',
    enum: UptimeStatus,
  })
  status: UptimeStatus;

  @Column({ type: 'integer', default: 0 })
  responseTimeMs: number;

  @Column({ type: 'timestamptz' })
  recordedAt: Date;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
