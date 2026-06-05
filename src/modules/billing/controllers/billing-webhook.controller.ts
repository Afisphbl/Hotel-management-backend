import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';

@Controller('webhooks/chapa')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

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
}
