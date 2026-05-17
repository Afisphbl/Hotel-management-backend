import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

@Controller('platform/hotels')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformHotelsController {
  constructor(private platformService: PlatformService) {}

  @Get()
  async getHotels() {
    return this.platformService.findAllHotels();
  }

  @Post()
  async createHotel(@Body() data: { name: string; subdomain?: string }) {
    return this.platformService.createHotel(data);
  }

  @Patch(':id')
  async updateHotel(@Param('id') id: string, @Body() data: any) {
    return this.platformService.updateHotel(id, data);
  }

  @Delete(':id')
  async deleteHotel(@Param('id') id: string) {
    return this.platformService.deleteHotel(id);
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
