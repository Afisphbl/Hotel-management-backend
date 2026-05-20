import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PII_PERMISSION_KEY } from '../decorators/pii.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    if (user.permissions?.includes('*')) {
      return true;
    }

    // Check PII permission first
    const piiPermission = this.reflector.getAllAndOverride<string>(
      PII_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (piiPermission) {
      // if (!user.permissions?.includes(piiPermission)) {
      if (!user.permissions?.includes(piiPermission) && !user.permissions?.includes('*')) {
        return false;
      }
    }

    // Check regular permissions
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    // permissions are embedded in JWT and potentially cached in Redis
    // The JwtStrategy should populate req.user.permissions
    return requiredPermissions.every((permission) =>
      user.permissions?.includes(permission) || user.permissions?.includes('*'),
    );
  }
}
