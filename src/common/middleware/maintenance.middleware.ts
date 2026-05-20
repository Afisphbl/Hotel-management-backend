import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { GlobalSetting } from '../../database/entities/global/global-setting.entity';
import { Hotel } from '../../database/entities/hotel.entity';
import { UserScope } from '../../database/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(
    private dataSource: DataSource,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Allow Super Admins to bypass maintenance
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const payload = this.jwtService.verify(token, {
          secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        }) as any;
        if (payload?.scope === UserScope.PLATFORM) {
          return next();
        }
      } catch (e) {
        // Continue to check maintenance if token is invalid
      }
    }

    // 2. Check Global Maintenance Mode
    const globalMaintenance = await this.dataSource
      .getRepository(GlobalSetting)
      .findOne({ where: { key: 'system:maintenance_mode' } });

    if (globalMaintenance?.value === true) {
      throw new ServiceUnavailableException(
        'The platform is currently undergoing maintenance. Please try again later.',
      );
    }

    // 3. Check Tenant Maintenance Mode
    // We try to extract hotelId from various places
    const hotelId = req.headers['x-hotel-id'] || req.query.hotelId;
    if (hotelId && typeof hotelId === 'string') {
      const hotel = await this.dataSource
        .getRepository(Hotel)
        .findOne({ where: { id: hotelId } });

      if (hotel?.maintenanceMode) {
        throw new ServiceUnavailableException(
          `The hotel "${hotel.name}" is currently undergoing maintenance.`,
        );
      }
    }

    next();
  }
}
