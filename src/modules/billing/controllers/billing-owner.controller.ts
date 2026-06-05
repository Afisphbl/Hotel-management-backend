import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from '../services/billing.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';

@Controller('billing')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard)
@Scopes(UserScope.HOTEL)
export class BillingOwnerController {
  constructor(private readonly billingService: BillingService) {}

  @Get('payment-status')
  async getPaymentStatus(@Request() req: any) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    const data = await this.billingService.getPaymentStatus(hotelId);
    return { success: true, data };
  }

  @Get('payment-history')
  async getPaymentHistory(@Request() req: any) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    const data = await this.billingService.getPaymentHistory(hotelId);
    return { success: true, data };
  }

  @Post('initiate-payment')
  @HttpCode(HttpStatus.OK)
  async initiatePayment(
    @Request() req: any,
    @Body('returnUrl') returnUrl?: string,
  ) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    const data = await this.billingService.initiateChapaPayment(hotelId, returnUrl);
    return { success: true, data };
  }

  @Post('upload-receipt')
  @HttpCode(HttpStatus.OK)
  async uploadReceipt(
    @Request() req: any,
    @Body('receiptUrl') receiptUrl: string,
  ) {
    if (!receiptUrl) {
      return { success: false, message: 'receiptUrl is required' };
    }
    const hotelId = req.user.hotelId || req.user.hotel_id;
    return this.billingService.uploadReceipt(hotelId, receiptUrl);
  }
}
