import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { SmtpService } from './smtp.service';
import type { SmtpConfig } from './smtp.service';
import { PaymentGatewayService } from '../../common/services/payment-gateway.service';
import type { PaymentGatewayConfig } from '../../common/services/payment-gateway.service';

@Controller('platform/config')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformConfigController {
  constructor(
    private readonly smtpService: SmtpService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  @Get('smtp')
  async getSmtpConfig() {
    const config = await this.smtpService.getConfig();
    return config ?? { configured: false };
  }

  @Post('smtp')
  @HttpCode(HttpStatus.OK)
  async updateSmtpConfig(@Body() config: SmtpConfig) {
    return this.smtpService.updateConfig(config);
  }

  @Post('smtp/test')
  @HttpCode(HttpStatus.OK)
  async testSmtpConnection(@Body('email') email?: string) {
    if (email) return this.smtpService.sendTestEmail(email);
    return this.smtpService.testConnection();
  }

  @Get('payment-gateway')
  async getPaymentGatewayConfig() {
    const config = await this.paymentGatewayService.getConfig();
    return config ?? { configured: false };
  }

  @Post('payment-gateway')
  @HttpCode(HttpStatus.OK)
  async updatePaymentGatewayConfig(@Body() config: PaymentGatewayConfig) {
    return this.paymentGatewayService.updateConfig(config);
  }

  @Post('payment-gateway/test')
  @HttpCode(HttpStatus.OK)
  async testPaymentGateway() {
    const config = await this.paymentGatewayService.getConfig();
    return { configured: !!config, mode: config?.mode ?? 'test' };
  }
}
