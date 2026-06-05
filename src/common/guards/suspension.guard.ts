import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Hotel, HotelStatus } from '../../database/entities/hotel.entity';

@Injectable()
export class SuspensionGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    const hotelId = request.tenantId || user.hotelId || user.hotel_id;
    if (!hotelId) return true;

    const hotel = await this.dataSource.getRepository(Hotel).findOne({
      where: { id: hotelId },
      select: { id: true, status: true },
    });

    if (!hotel) return true;

    if (hotel.status === HotelStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Account suspended. Please complete your monthly payment to restore access.',
      );
    }

    return true;
  }
}
