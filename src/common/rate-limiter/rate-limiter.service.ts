import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../modules/redis/redis.service';
import { DataSource } from 'typeorm';
import { GlobalSetting } from '../../database/entities/global/global-setting.entity';
import {
  Subscription,
  SubscriptionPlan,
} from '../../database/entities/global/subscriptions.entity';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstMultiplier?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  limit: number;
}

const DEFAULT_TIER_LIMITS: Record<string, RateLimitConfig> = {
  [SubscriptionPlan.BASIC]: {
    windowMs: 60000,
    maxRequests: 60,
    burstMultiplier: 1.5,
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    windowMs: 60000,
    maxRequests: 300,
    burstMultiplier: 2,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    windowMs: 60000,
    maxRequests: 1000,
    burstMultiplier: 3,
  },
  anonymous: { windowMs: 60000, maxRequests: 20, burstMultiplier: 1 },
};

const ENDPOINT_OVERIDES: Record<string, Partial<RateLimitConfig>> = {
  '/api/v1/auth/login': { windowMs: 60000, maxRequests: 10 },
  '/api/v1/auth/register': { windowMs: 3600000, maxRequests: 5 },
};

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private tierLimits: Record<string, RateLimitConfig> = {
    ...DEFAULT_TIER_LIMITS,
  };

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const setting = await this.dataSource
        .getRepository(GlobalSetting)
        .findOne({
          where: { key: 'rate_limiting:config' },
        });
      if (setting?.value) {
        this.tierLimits = { ...DEFAULT_TIER_LIMITS, ...setting.value };
      }
    } catch {
      this.logger.warn('Failed to load rate limit config, using defaults');
    }
  }

  async refreshConfig(): Promise<void> {
    await this.loadConfig();
  }

  async getTierForTenant(hotelId: string | null): Promise<string> {
    if (!hotelId) return 'anonymous';
    try {
      const sub = await this.dataSource.getRepository(Subscription).findOne({
        where: { hotel: { id: hotelId } },
        order: { createdAt: 'DESC' },
      });
      return sub?.plan ?? SubscriptionPlan.BASIC;
    } catch {
      return SubscriptionPlan.BASIC;
    }
  }

  async consume(
    key: string,
    hotelId: string | null,
    path?: string,
    cost: number = 1,
  ): Promise<RateLimitResult> {
    const tierId = await this.getTierForTenant(hotelId);
    const baseConfig = this.tierLimits[tierId] || this.tierLimits.anonymous;
    const endpointOverride = path ? ENDPOINT_OVERIDES[path] : null;
    const config: RateLimitConfig = endpointOverride
      ? { ...baseConfig, ...endpointOverride }
      : baseConfig;

    const windowSeconds = Math.ceil(config.windowMs / 1000);
    const now = Date.now();
    const bucket = Math.floor(now / config.windowMs);
    const redisKey = `ratelimit:${key}:${bucket}`;

    try {
      const current = await this.redis.incr(redisKey);
      if (current === 1) {
        await this.redis.pexpire(redisKey, config.windowMs);
      }

      const ttl = await this.redis.pttl(redisKey);
      const resetAt = now + ttl;

      const burstLimit = config.burstMultiplier
        ? Math.floor(config.maxRequests * config.burstMultiplier)
        : config.maxRequests;

      if (current > burstLimit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter: ttl,
          limit: burstLimit,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, burstLimit - current),
        resetAt,
        retryAfter: 0,
        limit: burstLimit,
      };
    } catch (err) {
      this.logger.error(`Rate limiter error: ${err.message}`);
      return {
        allowed: true,
        remaining: 1,
        resetAt: 0,
        retryAfter: 0,
        limit: 1,
      };
    }
  }

  async resetKey(key: string): Promise<void> {
    const pattern = `ratelimit:${key}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
