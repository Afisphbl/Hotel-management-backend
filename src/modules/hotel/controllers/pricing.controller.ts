import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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

  // ─── Price Overrides ────────────────────────────────────────────────────────

  @Get('overrides')
  async listOverrides(@Query('roomTypeId') roomTypeId?: string) {
    const result = await this.pricingService.listOverrides(roomTypeId);
    return success(result);
  }

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

  // ─── Promotions ─────────────────────────────────────────────────────────────

  @Get('promotions')
  async listPromotions(@Query('roomTypeId') roomTypeId?: string) {
    const result = await this.pricingService.listPromotions(roomTypeId);
    return success(result);
  }

  @Post('promotions')
  async createPromotion(@Body() data: any) {
    const result = await this.pricingService.createPromotion(data);
    return success(result);
  }

  @Patch('promotions/:id')
  async updatePromotion(@Param('id') id: string, @Body() data: any) {
    const result = await this.pricingService.updatePromotion(id, data);
    return success(result);
  }

  @Delete('promotions/:id')
  async deletePromotion(@Param('id') id: string) {
    await this.pricingService.deletePromotion(id);
    return success({ deleted: true });
  }

  // ─── Seasonal Rates ─────────────────────────────────────────────────────────

  @Get('seasonal-rates')
  async listSeasonalRates(@Query('roomTypeId') roomTypeId?: string) {
    const result = await this.pricingService.listSeasonalRates(roomTypeId);
    return success(result);
  }

  @Post('seasonal-rates')
  async createSeasonalRate(@Body() data: any) {
    const result = await this.pricingService.createSeasonalRate(data);
    return success(result);
  }

  @Patch('seasonal-rates/:id')
  async updateSeasonalRate(@Param('id') id: string, @Body() data: any) {
    const result = await this.pricingService.updateSeasonalRate(id, data);
    return success(result);
  }

  @Delete('seasonal-rates/:id')
  async deleteSeasonalRate(@Param('id') id: string) {
    await this.pricingService.deleteSeasonalRate(id);
    return success({ deleted: true });
  }

  // ─── Rate Plans ─────────────────────────────────────────────────────────────

  @Get('rate-plans')
  async listRatePlans(@Query('roomTypeId') roomTypeId?: string) {
    const result = await this.pricingService.listRatePlans(roomTypeId);
    return success(result);
  }

  @Post('rate-plans')
  async createRatePlan(@Body() data: any) {
    const result = await this.pricingService.createRatePlan(data);
    return success(result);
  }

  @Patch('rate-plans/:id')
  async updateRatePlan(@Param('id') id: string, @Body() data: any) {
    const result = await this.pricingService.updateRatePlan(id, data);
    return success(result);
  }

  @Delete('rate-plans/:id')
  async deleteRatePlan(@Param('id') id: string) {
    await this.pricingService.deleteRatePlan(id);
    return success({ deleted: true });
  }
}
