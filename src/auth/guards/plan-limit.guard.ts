import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Hotel } from '../../database/entities/hotel.entity';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../database/entities/global/subscriptions.entity';

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(private dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hotelId = request.user?.hotel_id;

    if (!hotelId) {
      return true; // No hotel context, skip (or handle as error if required)
    }

    const hotel = await this.dataSource.getRepository(Hotel).findOne({
      where: { id: hotelId },
    });

    if (!hotel) {
      throw new ForbiddenException('Hotel not found');
    }

    // Get active subscription
    const subscription = await this.dataSource
      .getRepository(Subscription)
      .findOne({
        where: { hotel: { id: hotelId }, status: SubscriptionStatus.ACTIVE },
      });

    const plan = subscription?.plan || SubscriptionPlan.BASIC;
    const roomLimit = this.getRoomLimit(plan);

    // Count existing rooms in tenant schema
    const roomCountResult = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${hotel.schemaName}"."rooms"`,
    );
    const roomCount = parseInt(roomCountResult[0]?.count || '0', 10);

    if (roomCount >= roomLimit) {
      throw new ForbiddenException(
        `Plan limit reached. Your current plan (${plan}) allows only ${roomLimit} rooms.`,
      );
    }

    return true;
  }

  private getRoomLimit(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.BASIC:
        return 50;
      case SubscriptionPlan.PROFESSIONAL:
        return 200;
      case SubscriptionPlan.ENTERPRISE:
        return 9999;
      default:
        return 50;
    }
  }
}
