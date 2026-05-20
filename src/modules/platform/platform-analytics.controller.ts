import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { RevenueAnalyticsService } from './revenue-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

@Controller('platform/analytics')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformAnalyticsController {
  constructor(
    private platformService: PlatformService,
    private revenueAnalyticsService: RevenueAnalyticsService,
  ) {}

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

  @Get('mrr')
  async getMRRBreakdown() {
    return this.revenueAnalyticsService.getMRRBreakdown();
  }

  @Get('churn')
  async getChurnMetrics() {
    return this.revenueAnalyticsService.getChurnMetrics();
  }

  @Get('financial-report')
  async getFinancialReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.revenueAnalyticsService.getDetailedFinancialReport(
      startDate,
      endDate,
    );
  }

  @Get('projections')
  async getRevenueProjections(@Query('months') months?: string) {
    const m = months ? parseInt(months, 10) : 3;
    return this.revenueAnalyticsService.getRevenueProjection(m);
  }
}
