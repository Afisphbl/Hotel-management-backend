import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PublicRoomsController } from './public-rooms.controller';
import { Hotel } from '../../database/entities/hotel.entity';
import { HotelModule } from '../hotel/hotel.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Hotel]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    HotelModule,
  ],
  controllers: [PublicController, PublicRoomsController],
  providers: [PublicService],
})
export class PublicModule {}
