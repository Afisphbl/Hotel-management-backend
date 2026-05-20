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

  @Get('kpis')
  async getPlatformKPIs() {
    return this.platformService.getPlatformKPIs();
  }

  @Get('revenue-chart')
  async getPlatformRevenueChart() {
    return this.platformService.getPlatformRevenueChart();
  }

  @Get('hotels-by-tier')
  async getPlatformHotelsByTier() {
    return this.platformService.getPlatformHotelsByTier();
  }

  @Get('revenue-summary')
  async getRevenueSummary() {
    return this.platformService.getRevenueSummary();
  }

  @Get('billing-report')
  async getBillingReport() {
    return this.platformService.getBillingReport();
  }

  @Get('audit-logs')
  async getPlatformAuditLogs() {
    return this.platformService.getPlatformAuditLogs();
  }
}
