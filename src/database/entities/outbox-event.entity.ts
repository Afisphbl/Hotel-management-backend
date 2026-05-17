import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity({ name: 'outbox_events' })
export class OutboxEvent extends BaseEntity {
  @Column()
  type: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({
    type: 'enum',
    enum: OutboxStatus,
    default: OutboxStatus.PENDING,
  })
  status: OutboxStatus;

  @Column({ nullable: true })
  error: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;
}
