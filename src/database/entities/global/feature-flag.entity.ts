import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Hotel } from '../hotel.entity';

export enum FeatureFlagStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  SCHEDULED = 'SCHEDULED',
}

export enum FeatureFlagRolloutStrategy {
  FULL_ROLLOUT = 'full_rollout',
  PERCENTAGE = 'percentage',
  USER_BASED = 'user_based',
  ROLE_BASED = 'role_based',
  CONDITIONAL = 'conditional',
  A_B_TEST = 'a_b_test',
}

export enum FeatureFlagEvaluationOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  CONTAINS = 'contains',
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  IN = 'in',
  NOT_IN = 'not_in',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  MATCHES = 'matches',
}

@Entity('feature_flags')
@Index(['status', 'rolloutStrategy'])
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Hotel, { nullable: true })
  @Index()
  hotel: Hotel;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: FeatureFlagStatus,
    default: FeatureFlagStatus.DISABLED,
  })
  status: FeatureFlagStatus;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledEnabledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledDisabledAt: Date | null;

  @Column({ type: 'text', nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  createdBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'enum', enum: FeatureFlagRolloutStrategy, nullable: true })
  rolloutStrategy: FeatureFlagRolloutStrategy;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  rolloutPercentage: number;

  @Column({ type: 'jsonb', nullable: true })
  targetingRules: Array<{
    attribute: string;
    operator: FeatureFlagEvaluationOperator;
    value: any;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  allowedUserIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  allowedRoleIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  excludedUserIds: string[];

  @Column({ type: 'jsonb', nullable: true })
  variants: Array<{
    name: string;
    weight: number;
    config: Record<string, any>;
  }>;
}
