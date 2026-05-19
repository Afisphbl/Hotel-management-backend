import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from '../services/payments.service';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../../database/entities/payment.entity';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { CreatePaymentDto, QueryPaymentDto } from '../dto/payment.dto';
import { success, paginated } from '../common/response';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  async findAll(@Query() query: QueryPaymentDto) {
    const result = await this.paymentsService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const payment = await this.paymentsService.findById(id);
    return success(payment);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async processPayment(@Body() dto: CreatePaymentDto) {
    const payment = await this.paymentsService.processPayment(dto);
    return success(payment);
  }

  @Get('by-invoice/:invoiceId')
  async findByInvoice(@Param('invoiceId') invoiceId: string) {
    const payments = await this.paymentsService.findByInvoice(invoiceId);
    return success(payments);
  }

  @Get('by-booking/:bookingId')
  async findByBooking(@Param('bookingId') bookingId: string) {
    const payments = await this.paymentsService.findByBooking(bookingId);
    return success(payments);
  }
}
