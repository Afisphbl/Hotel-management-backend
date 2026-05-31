import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';

import { success } from '../common/response.interceptor';

@Controller('hotel/reports')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard)
@Scopes(UserScope.HOTEL)
export class HotelOwnerReportsController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  async getReports(
    @Req() req: any,
    @Query('days') days?: number,
  ) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const data = await this.dashboardService.getReports(hotelId, days);
    return success(data);
  }
}
