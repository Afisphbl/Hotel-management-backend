import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SuspensionGuard } from '../../common/guards/suspension.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

@Controller('hotel/reviews')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, SuspensionGuard)
@Scopes(UserScope.HOTEL)
export class HotelReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const hotelId = req.user.hotel_id;
    return this.reviewsService.findAll(hotelId, { page, limit });
  }

  @Get('unseen-count')
  async countUnseen(@Request() req: any) {
    const hotelId = req.user.hotel_id;
    return this.reviewsService.countUnseen(hotelId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const hotelId = req.user.hotel_id;
    return this.reviewsService.updateStatus(hotelId, id, status);
  }

  @Patch(':id/visibility')
  async updateVisibility(
    @Request() req: any,
    @Param('id') id: string,
    @Body('isVisible') isVisible: boolean,
  ) {
    const hotelId = req.user.hotel_id;
    return this.reviewsService.updateVisibility(hotelId, id, isVisible);
  }

  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    const hotelId = req.user.hotel_id;
    return this.reviewsService.delete(hotelId, id);
  }
}
