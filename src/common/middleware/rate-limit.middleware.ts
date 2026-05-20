import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const hotelId = (req as any).hotel_id || null;
    const userId = (req as any).user?.userId || 'anonymous';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const path = req.originalUrl || req.url;

    const key = `tenant:${hotelId || 'global'}:user:${userId}:ip:${ipAddress}`;

    const result = await this.rateLimiter.consume(key, hotelId, path);

    res.setHeader('X-RateLimit-Limit', result.limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(result.resetAt / 1000).toString(),
    );

    if (!result.allowed) {
      res.setHeader(
        'Retry-After',
        Math.ceil(result.retryAfter / 1000).toString(),
      );
      throw new HttpException(
        {
          success: false,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please wait before retrying.',
          meta: {
            retryAfterMs: result.retryAfter,
            limit: result.limit,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
