import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWTPayload } from '../interfaces/jwt-payload.interface';

export const PERMISSIONS_KEY = 'permissions';
export const PUBLIC_KEY = 'public';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JWTPayload = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    return true;
  }
}