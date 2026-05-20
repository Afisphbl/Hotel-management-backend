import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { PLAN_LIMIT_KEY, PlanLimitResource } from '../../common/decorators/plan-limit.decorator';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantQuotaService: TenantQuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hotelId = request.user?.hotel_id;
    const resource = this.reflector.getAllAndOverride<PlanLimitResource>(
      PLAN_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resource || !hotelId) {
      return true;
    }

    if (resource === 'rooms') {
      const result = await this.tenantQuotaService.assertRoomCapacity(hotelId);
      if (result.overage) {
        request.overageCost = result.overageCost;
      }
      return true;
    }

    if (resource === 'users') {
      const result = await this.tenantQuotaService.assertUserCapacity(hotelId);
      if (result.overage) {
        request.overageCost = result.overageCost;
      }
      return true;
    }

    if (resource === 'storage') {
      const rawSizeMb =
        request.body?.sizeMb ?? request.body?.storageSizeMb ?? request.query?.sizeMb;
      const sizeMb = Number(rawSizeMb);

      if (!Number.isFinite(sizeMb) || sizeMb <= 0) {
        throw new BadRequestException('sizeMb is required for storage operations');
      }

      const result = await this.tenantQuotaService.assertStorageCapacity(hotelId, sizeMb);
      if (result.overage) {
        request.overageCost = result.overageCost;
      }
      return true;
    }

    return true;
  }
}
