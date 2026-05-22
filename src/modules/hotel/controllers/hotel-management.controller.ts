import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { HotelManagementService } from '../services/hotel-management.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { success } from '../common/response.interceptor';

@Controller('hotel/owner/hotels')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.HOTEL)
export class HotelManagementController {
  constructor(private readonly hotelManagementService: HotelManagementService) {}

  @Get()
  async findAll(@Request() req: any) {
    const ownerEmail = req.user?.email;
    const hotels = await this.hotelManagementService.findByOwner(ownerEmail);
    return success(hotels);
  }

  @Post()
  async create(@Body() data: any, @Request() req: any) {
    data.ownerEmail = req.user?.email;
    const hotel = await this.hotelManagementService.create(data);
    return success(hotel);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const hotel = await this.hotelManagementService.update(id, data);
    return success(hotel);
  }

  @Patch(':id/activate')
  async setActive(@Param('id') id: string, @Body('active') active: boolean) {
    const hotel = await this.hotelManagementService.setActive(id, active);
    return success(hotel);
  }

  @Post(':id/branding')
  async updateBranding(@Param('id') id: string, @Body('branding') branding: any) {
    const hotel = await this.hotelManagementService.updateBranding(id, branding);
    return success(hotel);
  }
}
