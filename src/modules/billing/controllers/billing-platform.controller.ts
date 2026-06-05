import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';

class SetRateDto {
  @IsNumber()
  @Min(0)
  rate: number;
}

class ConfirmPaymentDto {
  @IsUUID()
  paymentId: string;
}

class OverrideSuspensionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('platform/billing')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class BillingPlatformController {
  constructor(private readonly billingService: BillingService) {}

  @Get('hotels')
  async getAllBillingStatus() {
    const data = await this.billingService.getAllBillingStatus();
    return { success: true, data };
  }

  @Get(':hotelId/history')
  async getPaymentHistory(@Param('hotelId') id: string) {
    const data = await this.billingService.getPaymentHistory(id);
    return { success: true, data };
  }

  @Patch(':hotelId/rate')
  @HttpCode(HttpStatus.OK)
  async setMonthlyRate(@Param('hotelId') id: string, @Body() dto: SetRateDto) {
    return this.billingService.setMonthlyRate(id, dto.rate);
  }

  @Patch(':hotelId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Param('hotelId') hotelId: string,
    @Body() dto: ConfirmPaymentDto,
    @Request() req: any,
  ) {
    return this.billingService.confirmPayment(dto.paymentId, req.user.userId);
  }

  @Patch(':hotelId/override')
  @HttpCode(HttpStatus.OK)
  async overrideSuspension(
    @Param('hotelId') id: string,
    @Body() dto: OverrideSuspensionDto,
    @Request() req: any,
  ) {
    return this.billingService.overrideSuspension(
      id,
      req.user.userId,
      dto.reason,
    );
  }
}
