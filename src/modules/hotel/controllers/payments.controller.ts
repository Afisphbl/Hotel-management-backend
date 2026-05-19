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
import { RefundReason } from '../../../database/entities/refund.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';
import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';

class ProcessPaymentBodyDto {
  @IsUUID() invoiceId: string;
  @IsNumber() @Min(0) amount: number;
  @IsString() method: PaymentMethod;
  @IsOptional() @IsString() transactionId?: string;
  @IsOptional() gatewayResponse?: any;
  @IsString() idempotencyKey: string;
}

class RefundBodyDto {
  @IsNumber() @Min(0) amount: number;
  @IsString() reason: RefundReason;
  @IsString() idempotencyKey: string;
  @IsOptional() @IsString() notes?: string;
}

@Controller('hotel/payments')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & {
      status?: PaymentStatus;
      invoiceId?: string;
      method?: PaymentMethod;
    },
  ) {
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
  async processPayment(@Body() dto: ProcessPaymentBodyDto) {
    const payment = await this.paymentsService.processPayment(dto);
    return success(payment);
  }

  @Post(':id/refund')
  async refund(@Param('id') id: string, @Body() dto: RefundBodyDto) {
    const refund = await this.paymentsService.refund(id, dto);
    return success(refund);
  }

  @Get(':id/refunds')
  async getRefunds(@Param('id') id: string) {
    const refunds = await this.paymentsService.getRefunds(id);
    return success(refunds);
  }
}
