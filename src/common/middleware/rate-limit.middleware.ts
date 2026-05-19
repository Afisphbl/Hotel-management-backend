import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../modules/redis/redis.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // 100 requests per minute
    const keyPrefix = 'api';

    // Get tenant_id from JWT if available
    const tenantId = (req as any).hotel_id || 'anonymous';
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

    // Create rate limit key: tenant:{hotel_id}:rate_limit:{ip}
    const key = `tenant:${tenantId}:${keyPrefix}:${ipAddress}`;

    try {
      // Get current count
      const current = await this.redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await this.redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Check if limit exceeded
      if (current > maxRequests) {
        const ttl = await this.redis.ttl(key);
        throw new HttpException(
          {
            success: false,
            error: 'Too many requests',
            meta: {
              retryAfter: ttl,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader(
        'X-RateLimit-Remaining',
        (maxRequests - current).toString(),
      );
      const ttl = await this.redis.ttl(key);
      res.setHeader('X-RateLimit-Reset', ttl.toString());

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis fails, allow request (fail-open)
      next();
    }
  }
}
