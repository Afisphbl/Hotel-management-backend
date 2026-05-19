import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: JWTPayload = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // PLATFORM scope users don't need hotel_id
    if (user.scope === 'PLATFORM') {
      return true;
    }

    // HOTEL scope users must have hotel_id
    if (!user.hotel_id) {
      throw new UnauthorizedException(
        'Hotel ID required for hotel scope access',
      );
    }

    // Set tenant context for database queries
    request.tenantId = user.hotel_id;
    return true;
  }
}
