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
  Request,
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

  private hotelId(req: any): string {
    return req.user.hotel_id || req.user.hotelId;
  }

  // ─── Overrides ──────────────────────────────────────────────────────────────
  @Get('overrides')
  async listOverrides(
    @Request() req: any,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return success(
      await this.pricingService.listOverrides(this.hotelId(req), roomTypeId),
    );
  }

  @Post('overrides')
  async createOverride(@Request() req: any, @Body() data: any) {
    return success(
      await this.pricingService.createOverride(this.hotelId(req), data),
    );
  }

  @Delete('overrides/:id')
  async deleteOverride(@Request() req: any, @Param('id') id: string) {
    await this.pricingService.deleteOverride(this.hotelId(req), id);
    return success({ deleted: true });
  }

  // ─── Promotions ─────────────────────────────────────────────────────────────
  @Get('promotions')
  async listPromotions(
    @Request() req: any,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return success(
      await this.pricingService.listPromotions(this.hotelId(req), roomTypeId),
    );
  }

  @Post('promotions')
  async createPromotion(@Request() req: any, @Body() data: any) {
    return success(
      await this.pricingService.createPromotion(this.hotelId(req), data),
    );
  }

  @Patch('promotions/:id')
  async updatePromotion(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return success(
      await this.pricingService.updatePromotion(this.hotelId(req), id, data),
    );
  }

  @Delete('promotions/:id')
  async deletePromotion(@Request() req: any, @Param('id') id: string) {
    await this.pricingService.deletePromotion(this.hotelId(req), id);
    return success({ deleted: true });
  }

  // ─── Seasonal Rates ─────────────────────────────────────────────────────────
  @Get('seasonal-rates')
  async listSeasonalRates(
    @Request() req: any,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return success(
      await this.pricingService.listSeasonalRates(
        this.hotelId(req),
        roomTypeId,
      ),
    );
  }

  @Post('seasonal-rates')
  async createSeasonalRate(@Request() req: any, @Body() data: any) {
    return success(
      await this.pricingService.createSeasonalRate(this.hotelId(req), data),
    );
  }

  @Patch('seasonal-rates/:id')
  async updateSeasonalRate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return success(
      await this.pricingService.updateSeasonalRate(this.hotelId(req), id, data),
    );
  }

  @Delete('seasonal-rates/:id')
  async deleteSeasonalRate(@Request() req: any, @Param('id') id: string) {
    await this.pricingService.deleteSeasonalRate(this.hotelId(req), id);
    return success({ deleted: true });
  }

  // ─── Rate Plans ─────────────────────────────────────────────────────────────
  @Get('rate-plans')
  async listRatePlans(
    @Request() req: any,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return success(
      await this.pricingService.listRatePlans(this.hotelId(req), roomTypeId),
    );
  }

  @Post('rate-plans')
  async createRatePlan(@Request() req: any, @Body() data: any) {
    return success(
      await this.pricingService.createRatePlan(this.hotelId(req), data),
    );
  }

  @Patch('rate-plans/:id')
  async updateRatePlan(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: any,
  ) {
    return success(
      await this.pricingService.updateRatePlan(this.hotelId(req), id, data),
    );
  }

  @Delete('rate-plans/:id')
  async deleteRatePlan(@Request() req: any, @Param('id') id: string) {
    await this.pricingService.deleteRatePlan(this.hotelId(req), id);
    return success({ deleted: true });
  }
}
