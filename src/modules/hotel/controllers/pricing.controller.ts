import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PricingService } from '../services/pricing.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { success } from '../common/response.interceptor';

@Controller('hotel/pricing')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Post('overrides')
  async createOverride(@Body() data: any) {
    const result = await this.pricingService.createOverride(data);
    return success(result);
  }

  @Delete('overrides/:id')
  async deleteOverride(@Param('id') id: string) {
    await this.pricingService.deleteOverride(id);
    return success({ deleted: true });
  }

  @Post('promotions')
  async createPromotion(@Body() data: any) {
    const result = await this.pricingService.createPromotion(data);
    return success(result);
  }

  @Delete('promotions/:id')
  async deletePromotion(@Param('id') id: string) {
    await this.pricingService.deletePromotion(id);
    return success({ deleted: true });
  }

  @Post('seasonal-rates')
  async createSeasonalRate(@Body() data: any) {
    const result = await this.pricingService.createSeasonalRate(data);
    return success(result);
  }

  @Delete('seasonal-rates/:id')
  async deleteSeasonalRate(@Param('id') id: string) {
    await this.pricingService.deleteSeasonalRate(id);
    return success({ deleted: true });
  }

  @Post('weekday-rules')
  async createWeekdayRule(@Body() data: any) {
    const result = await this.pricingService.createWeekdayRule(data);
    return success(result);
  }

  @Delete('weekday-rules/:id')
  async deleteWeekdayRule(@Param('id') id: string) {
    await this.pricingService.deleteWeekdayRule(id);
    return success({ deleted: true });
  }
}
