import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

@Controller('platform/analytics')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformAnalyticsController {
  constructor(private platformService: PlatformService) {}

  @Get('global')
  async getGlobalAnalytics() {
    return this.platformService.getGlobalAnalytics();
  }
}
