import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTPayload } from '../interfaces/jwt-payload.interface';

export const SCOPE_KEY = 'scope';
export const PLATFORM_SCOPE = 'PLATFORM';
export const HOTEL_SCOPE = 'HOTEL';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<string>(SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JWTPayload = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (user.scope !== requiredScope) {
      throw new UnauthorizedException(
        `Access denied. Required scope: ${requiredScope}`,
      );
    }

    return true;
  }
}
