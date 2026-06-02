import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Controller('public/reviews')
export class PublicReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':roomId')
  async findByRoomId(
    @Query('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
  ) {
    const reviews = await this.reviewsService.findByRoomId(hotelId, roomId);
    const stats = await this.reviewsService.getAverageRating(hotelId, roomId);
    
    return {
      reviews,
      stats,
    };
  }

  @Post()
  async create(
    @Headers('authorization') authHeader: string,
    @Body() dto: { hotelId: string, roomId: string, rating: number, comment: string },
  ) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (String(payload.hotel_id) !== String(dto.hotelId)) {
      throw new UnauthorizedException('Token not valid for this hotel');
    }

    return this.reviewsService.create(dto.hotelId, payload.sub, dto);
  }
}
