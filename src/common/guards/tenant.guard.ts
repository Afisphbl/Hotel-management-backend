import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserScope } from '../../database/entities/user.entity';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Platform users don't need a hotel_id for platform routes
    if (user.scope === UserScope.PLATFORM) {
      return true;
    }

    const hotelIdFromToken = user.hotel_id;
    const hotelIdFromRequest = request['hotel_id'];

    if (!hotelIdFromToken || (hotelIdFromRequest && hotelIdFromToken !== hotelIdFromRequest)) {
      throw new ForbiddenException('Tenant mismatch or unauthorized access to tenant');
    }

    return true;
  }
}
