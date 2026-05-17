import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    try {
      const payload = this.jwtService.decode(token) as any;
      if (payload && payload.hotel_id) {
        req['hotel_id'] = payload.hotel_id;
        req['tenant_schema'] = `hotel_${payload.hotel_id.replace(/-/g, '_')}`;
      }
      next();
    } catch (e) {
      next();
    }
  }
}
