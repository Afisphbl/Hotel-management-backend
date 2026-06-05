import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Redirect,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from '../services/billing.service';

@Controller('webhooks/chapa')
export class BillingWebhookController {
  private readonly frontendUrl: string;

  constructor(
    private readonly billingService: BillingService,
    config: ConfigService,
  ) {
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') || 'http://abdures.localhost:3000';
  }

  @Post('subscription')
  @HttpCode(HttpStatus.OK)
  async handleSubscriptionWebhook(
    @Body() body: any,
    @Headers('x-chapa-signature') signature: string,
    @Headers('chapa-signature') altSignature: string,
  ) {
    const sig = signature || altSignature;
    if (!sig) {
      throw new BadRequestException('Missing Chapa webhook signature');
    }
    return this.billingService.handleChapaWebhook(body, sig);
  }

  @Get('subscription')
  @Redirect()
  async handleSubscriptionCallback(
    @Query('trx_ref') txRef: string,
    @Query('status') status: string,
  ) {
    return { url: `${this.frontendUrl}/hotel/owner/billing?payment=${status || 'completed'}&tx_ref=${txRef || ''}`, statusCode: 302 };
  }
}
