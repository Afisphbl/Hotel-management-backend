import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Hotel } from '../hotel.entity';

export enum FeatureFlagStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  SCHEDULED = 'SCHEDULED',
}

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Hotel, { nullable: true })
  hotel: Hotel;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: FeatureFlagStatus, default: FeatureFlagStatus.DISABLED })
  status: FeatureFlagStatus;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledEnabledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledDisabledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  createdBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}