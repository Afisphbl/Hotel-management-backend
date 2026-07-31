import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PublicRoomsController } from './public-rooms.controller';
import { PublicReviewsController } from './public-reviews.controller';
import { HotelReviewsController } from './hotel-reviews.controller';
import { ReviewsService } from './reviews.service';
import { PasswordPolicyService } from '../../common/services/password-policy.service';
import { Hotel } from '../../database/entities/hotel.entity';
import { HotelUserAccess } from '../../database/entities/hotel-user-access.entity';
import { HotelModule } from '../hotel/hotel.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hotel, HotelUserAccess]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '1h') },
      }),
    }),
    HotelModule,
    WorkersModule,
  ],
  controllers: [
    PublicController,
    PublicRoomsController,
    PublicReviewsController,
    HotelReviewsController,
  ],
  providers: [PublicService, ReviewsService, PasswordPolicyService],
})
export class PublicModule {}
