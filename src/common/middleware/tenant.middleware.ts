import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { runWithTenantSchema } from '../tenant/tenant-context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
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
        }
      } catch {
        // Leave tenant as global for unauthenticated or invalid tokens.
      }
    }

    req['tenant_schema'] = tenantSchema;
    return runWithTenantSchema(tenantSchema, () => next());
  }
}
