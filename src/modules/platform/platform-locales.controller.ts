import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { LocaleService } from './locale.service';

@Controller('platform/locales')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformLocalesController {
  constructor(private readonly localeService: LocaleService) {}

  @Get()
  async findAll() {
    return this.localeService.findAll();
  }

  @Get(':hotelId')
  async findByHotel(@Param('hotelId') hotelId: string) {
    return this.localeService.findByHotel(hotelId);
  }

  @Post(':hotelId')
  async upsert(@Param('hotelId') hotelId: string, @Body() data: any) {
    return this.localeService.upsert(hotelId, data);
  }
}
