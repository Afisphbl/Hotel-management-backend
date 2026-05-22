import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { Hotel } from '../../database/entities/hotel.entity';
import { CreateHotelDto } from './dto/create-hotel.dto';

@Controller('platform/hotels')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformHotelsController {
  constructor(private platformService: PlatformService) {}

  @Get()
  async getHotels(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 15,
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.platformService.findAllHotelsPaginated({
      page: Number(page),
      limit: Number(limit),
      search,
      plan,
      sortBy,
    });
  }

  @Post()
  async createHotel(@Body() data: CreateHotelDto) {
    return this.platformService.createHotel(data);
  }

  @Get(':id')
  async getHotel(@Param('id') id: string) {
    return this.platformService.findHotelById(id);
  }

  @Patch(':id')
  async updateHotel(@Param('id') id: string, @Body() data: Partial<Hotel>) {
    return this.platformService.updateHotel(id, data);
  }

  @Patch(':id/branding')
  async updateBranding(@Param('id') id: string, @Body() data: any) {
    return this.platformService.updateBranding(id, data);
  }

  @Delete(':id')
  async deleteHotel(@Param('id') id: string) {
    return this.platformService.deleteHotel(id);
  }

  @Post(':id/features/:featureId/toggle')
  async toggleFeature(
    @Param('id') id: string,
    @Param('featureId') featureId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.platformService.toggleHotelFeature(id, featureId, enabled);
  }

  @Get('staff')
  async getPlatformStaff() {
    return this.platformService.findAllPlatformStaff();
  }

  @Post('staff')
  async createPlatformStaff(@Body() data: any) {
    return this.platformService.createPlatformStaff(data);
  }
}
