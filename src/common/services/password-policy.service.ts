import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  GlobalSetting,
  SettingCategory,
} from '../../database/entities/global/global-setting.entity';
import { randomBytes } from 'crypto';

export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

const DEFAULT_POLICY: PasswordPolicyConfig = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
};

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  async getPolicy(): Promise<PasswordPolicyConfig> {
    const setting = await this.dataSource.getRepository(GlobalSetting).findOne({
      where: { key: 'security:password_policy' },
    });

    if (!setting?.value) {
      return DEFAULT_POLICY;
    }

    return {
      ...DEFAULT_POLICY,
      ...setting.value,
    };
  }

  async updatePolicy(policy: Partial<PasswordPolicyConfig>) {
    const repository = this.dataSource.getRepository(GlobalSetting);
    const merged = {
      ...(await this.getPolicy()),
      ...policy,
    };

    const setting = await repository.findOne({
      where: { key: 'security:password_policy' },
    });

    if (setting) {
      setting.value = merged;
      setting.category = setting.category || SettingCategory.COMPLIANCE;
      return repository.save(setting);
    }

    return repository.save(
      repository.create({
        key: 'security:password_policy',
        value: merged,
        category: SettingCategory.COMPLIANCE,
        description: 'Platform password complexity policy',
      }),
    );
  }

  async assertCompliant(password: string): Promise<void> {
    const policy = await this.getPolicy();
    const violations: string[] = [];

    if (password.length < policy.minLength) {
      violations.push(`at least ${policy.minLength} characters`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('one uppercase letter');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('one lowercase letter');
    }
    if (policy.requireNumber && !/[0-9]/.test(password)) {
      violations.push('one number');
    }
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      violations.push('one symbol');
    }

    if (violations.length > 0) {
      throw new BadRequestException(
        `Password must contain ${violations.join(', ')}`,
      );
    }
  }

  async generateTemporaryPassword(): Promise<string> {
    const policy = await this.getPolicy();
    const suffix = '!Aa1';
    const length = Math.max(policy.minLength, 16);
    const randomPart = randomBytes(length).toString('base64url').slice(0, length);
    return `${randomPart}${suffix}`;
  }
}
