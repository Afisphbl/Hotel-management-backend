import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { runWithTenantSchema } from '../tenant/tenant-context';

// Routes a suspended hotel owner can still access
const SUSPENSION_ALLOWED = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/logout/ },
  { method: 'GET',  pattern: /^\/api\/v1\/billing/ },
  { method: 'POST', pattern: /^\/api\/v1\/billing/ },
  { method: 'GET',  pattern: /^\/api\/v1\/notifications/ },
  { method: 'PATCH',pattern: /^\/api\/v1\/notifications/ },
];

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantSchema = 'global';
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        });

        if (payload?.hotel_id) {
          req['hotel_id'] = payload.hotel_id;
          tenantSchema = `hotel_${payload.hotel_id.replace(/-/g, '_')}`;

          // Check suspension for hotel-scoped requests
          const rows = await this.dataSource.query(
            `SELECT status FROM global.hotels WHERE id = $1 LIMIT 1`,
            [payload.hotel_id],
          );

          if (rows[0]?.status === 'SUSPENDED') {
            const path = req.path;
            const method = req.method;
            const allowed = SUSPENSION_ALLOWED.some(
              (r) => r.method === method && r.pattern.test(path),
            );

            if (!allowed) {
              res.status(403).json({
                statusCode: 403,
                message: 'Hotel account is suspended. Please pay your outstanding bill to restore access.',
                error: 'HOTEL_SUSPENDED',
              });
              return;
            }
          }
        }
      } catch {
        // Leave tenant as global for unauthenticated or invalid tokens.
      }
    }

    req['tenant_schema'] = tenantSchema;
    return runWithTenantSchema(tenantSchema, () => next());
  }
}
