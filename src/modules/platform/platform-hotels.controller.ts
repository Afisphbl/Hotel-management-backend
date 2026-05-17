import { Controller, Get, UseGuards } from '@nestjs/common';
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

  @Get('staff')
  async getPlatformStaff() {
    return this.platformService.findAllPlatformStaff();
  }
}
