import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { HotelManagementExtendedService } from '../services/hotel-management-extended.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/owner/hotels')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.HOTEL)
export class HotelManagementExtendedController {
  constructor(private readonly svc: HotelManagementExtendedService) {}

  @Patch(':id/info')
  async updateInfo(@Param('id') id: string, @Body() data: any) {
    const hotel = await this.svc.updateInfo(id, data);
    return success(hotel);
  }

  @Patch(':id/settings')
  async updateSettings(@Param('id') id: string, @Body() settings: any) {
    const hotel = await this.svc.updateSettings(id, settings);
    return success(hotel);
  }

  @Patch(':id/timezone-currency-taxes')
  async setTimezoneCurrencyTaxes(
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const hotel = await this.svc.setTimezoneCurrencyTaxes(id, payload);
    return success(hotel);
  }

  @Patch(':id/subscription')
  async updateSubscription(@Param('id') id: string, @Body() subscription: any) {
    const hotel = await this.svc.updateSubscription(id, subscription);
    return success(hotel);
  }

  @Get(':id/performance')
  async getPerformance(@Param('id') id: string, @Query('days') days?: string) {
    const metrics = await this.svc.getPerformance(
      id,
      days ? parseInt(days, 10) : 30,
    );
    return success(metrics);
  }

  @Patch(':id/booking-policies')
  async setBookingPolicies(@Param('id') id: string, @Body() policies: any) {
    const hotel = await this.svc.setBookingPolicies(id, policies);
    return success(hotel);
  }

  @Post(':id/admins')
  async addAdmin(@Param('id') id: string, @Body('email') email: string) {
    const hotel = await this.svc.addAdmin(id, email);
    return success(hotel);
  }

  @Patch(':id/modules')
  async setModules(@Param('id') id: string, @Body('modules') modules: any) {
    const hotel = await this.svc.setModules(id, modules);
    return success(hotel);
  }

  @Get(':id/audit-logs')
  async getAuditLogs(@Param('id') id: string, @Query('limit') limit = '50') {
    const logs = await this.svc.getAuditLogs(id, parseInt(limit, 10));
    return paginated(logs, logs.length, 1, parseInt(limit, 10));
  }

  @Patch(':id/notifications')
  async setNotifications(
    @Param('id') id: string,
    @Body('notifications') notifications: any,
  ) {
    const hotel = await this.svc.setNotifications(id, notifications);
    return success(hotel);
  }

  @Patch(':id/payment-methods')
  async setPaymentMethods(
    @Param('id') id: string,
    @Body('methods') methods: any,
  ) {
    const hotel = await this.svc.setPaymentMethods(id, methods);
    return success(hotel);
  }

  @Patch(':id/cancellation-policy')
  async setCancellationPolicy(
    @Param('id') id: string,
    @Body('policy') policy: any,
  ) {
    const hotel = await this.svc.setCancellationPolicy(id, policy);
    return success(hotel);
  }
}
