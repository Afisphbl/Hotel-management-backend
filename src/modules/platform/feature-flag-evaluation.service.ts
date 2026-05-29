import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import {
  FeatureFlag,
  FeatureFlagStatus,
  FeatureFlagRolloutStrategy,
  FeatureFlagEvaluationOperator,
} from '../../database/entities/global/feature-flag.entity';

export interface EvaluationContext {
  userId: string;
  roleId?: string;
  roleName?: string;
  email?: string;
  attributes?: Record<string, any>;
}

@Injectable()
export class FeatureFlagEvaluationService {
  private readonly logger = new Logger(FeatureFlagEvaluationService.name);

  constructor(
    @InjectRepository(FeatureFlag)
    private featureFlagRepository: Repository<FeatureFlag>,
  ) {}

  async isEnabled(
    flagName: string,
    context: EvaluationContext,
  ): Promise<boolean> {
    const flag = await this.featureFlagRepository.findOne({
      where: { name: flagName },
    });
    if (!flag) return false;
    return this.evaluate(flag, context);
  }

  async getVariant(
    flagName: string,
    context: EvaluationContext,
  ): Promise<{
    enabled: boolean;
    variant?: string;
    config?: Record<string, any>;
  }> {
    const flag = await this.featureFlagRepository.findOne({
      where: { name: flagName },
    });
    if (!flag) return { enabled: false };

    const enabled = await this.evaluate(flag, context);
    if (!enabled) return { enabled: false };

    if (
      flag.rolloutStrategy === FeatureFlagRolloutStrategy.A_B_TEST &&
      flag.variants?.length
    ) {
      const assigned = this.assignVariant(context.userId, flag.variants);
      return { enabled: true, variant: assigned.name, config: assigned.config };
    }

    return { enabled: true };
  }

  async evaluate(
    flag: FeatureFlag,
    context: EvaluationContext,
  ): Promise<boolean> {
    if (flag.status === FeatureFlagStatus.DISABLED) return false;
    if (flag.status === FeatureFlagStatus.SCHEDULED) {
      const now = new Date();
      if (flag.scheduledEnabledAt && now < flag.scheduledEnabledAt)
        return false;
      if (flag.scheduledDisabledAt && now >= flag.scheduledDisabledAt)
        return false;
    }

    if (
      !flag.rolloutStrategy ||
      flag.rolloutStrategy === FeatureFlagRolloutStrategy.FULL_ROLLOUT
    ) {
      return flag.status === FeatureFlagStatus.ENABLED;
    }

    if (
      flag.allowedUserIds?.length &&
      flag.allowedUserIds.includes(context.userId)
    ) {
      return true;
    }

    if (
      flag.excludedUserIds?.length &&
      flag.excludedUserIds.includes(context.userId)
    ) {
      return false;
    }

    if (flag.rolloutStrategy === FeatureFlagRolloutStrategy.USER_BASED) {
      const ids = flag.allowedUserIds;
      return Array.isArray(ids) ? ids.includes(context.userId) : false;
    }

    if (flag.rolloutStrategy === FeatureFlagRolloutStrategy.ROLE_BASED) {
      const ids = flag.allowedRoleIds;
      return Array.isArray(ids) && context.roleId
        ? ids.includes(context.roleId)
        : false;
    }

    if (
      flag.rolloutStrategy === FeatureFlagRolloutStrategy.PERCENTAGE &&
      flag.rolloutPercentage != null
    ) {
      const hash = this.hashUser(context.userId);
      return hash < flag.rolloutPercentage;
    }

    if (
      flag.rolloutStrategy === FeatureFlagRolloutStrategy.CONDITIONAL &&
      flag.targetingRules?.length
    ) {
      return this.evaluateTargetingRules(flag.targetingRules, context);
    }

    return flag.status === FeatureFlagStatus.ENABLED;
  }

  private evaluateTargetingRules(
    rules: Array<{
      attribute: string;
      operator: FeatureFlagEvaluationOperator;
      value: any;
    }>,
    context: EvaluationContext,
  ): boolean {
    const attrs = {
      ...context.attributes,
      userId: context.userId,
      roleId: context.roleId,
      email: context.email,
    };
    return rules.every((rule) => {
      const actualValue = attrs[rule.attribute];
      if (actualValue === undefined) return false;

      switch (rule.operator) {
        case FeatureFlagEvaluationOperator.EQUALS:
          return actualValue === rule.value;
        case FeatureFlagEvaluationOperator.NOT_EQUALS:
          return actualValue !== rule.value;
        case FeatureFlagEvaluationOperator.CONTAINS:
          return String(actualValue).includes(String(rule.value));
        case FeatureFlagEvaluationOperator.GREATER_THAN:
          return Number(actualValue) > Number(rule.value);
        case FeatureFlagEvaluationOperator.LESS_THAN:
          return Number(actualValue) < Number(rule.value);
        case FeatureFlagEvaluationOperator.IN:
          return Array.isArray(rule.value) && rule.value.includes(actualValue);
        case FeatureFlagEvaluationOperator.NOT_IN:
          return Array.isArray(rule.value) && !rule.value.includes(actualValue);
        case FeatureFlagEvaluationOperator.STARTS_WITH:
          return String(actualValue).startsWith(String(rule.value));
        case FeatureFlagEvaluationOperator.ENDS_WITH:
          return String(actualValue).endsWith(String(rule.value));
        case FeatureFlagEvaluationOperator.MATCHES:
          return new RegExp(String(rule.value)).test(String(actualValue));
        default:
          return false;
      }
    });
  }

  private hashUser(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return (Math.abs(hash) % 10000) / 100;
  }

  private assignVariant(
    userId: string,
    variants: Array<{
      name: string;
      weight: number;
      config: Record<string, any>;
    }>,
  ): { name: string; config: Record<string, any> } {
    const hash = this.hashUser(userId);
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += (variant.weight / totalWeight) * 100;
      if (hash <= cumulative) return variant;
    }
    return variants[variants.length - 1];
  }
}
