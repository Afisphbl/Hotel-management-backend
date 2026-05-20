import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantQuotaService } from '../../common/services/tenant-quota.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

@Controller('platform/quota')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformQuotaController {
  constructor(private readonly quotaService: TenantQuotaService) {}

  @Get('snapshot/:hotelId')
  async getQuotaSnapshot(@Param('hotelId') hotelId: string) {
    return this.quotaService.getQuotaSnapshot(hotelId);
  }

  @Get('utilization/:hotelId')
  async getQuotaUtilization(@Param('hotelId') hotelId: string) {
    return this.quotaService.getQuotaUtilization(hotelId);
  }

  @Post('sync/:hotelId')
  async syncQuota(@Param('hotelId') hotelId: string) {
    return this.quotaService.syncQuotaSnapshot(hotelId);
  }

  @Get('overage/:hotelId')
  async getOverageBilling(@Param('hotelId') hotelId: string) {
    return this.quotaService.getOverageBilling(hotelId);
  }

  @Post('overage/bill/:hotelId')
  async billOverage(@Param('hotelId') hotelId: string) {
    return this.quotaService.billOverage(hotelId);
  }

  @Get('alerts')
  async getAlerts(@Query('hotelId') hotelId?: string) {
    return this.quotaService.getAlerts(hotelId);
  }

  @Post('alerts/:id/dismiss')
  async dismissAlert(@Param('id') id: string) {
    return this.quotaService.dismissAlert(id);
  }
}
