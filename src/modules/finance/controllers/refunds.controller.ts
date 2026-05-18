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
import { RefundsService } from '../services/refunds.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { CreateRefundDto, QueryRefundDto } from '../dto/refund.dto';
import { success, paginated } from '../common/response';

@Controller('finance/refunds')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class RefundsController {
  constructor(private refundsService: RefundsService) {}

  @Get()
  async findAll(@Query() query: QueryRefundDto) {
    const result = await this.refundsService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const refund = await this.refundsService.findById(id);
    return success(refund);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createRefund(@Body() dto: CreateRefundDto) {
    const refund = await this.refundsService.createRefund(dto);
    return success(refund);
  }

  @Get('by-payment/:paymentId')
  async findByPayment(@Param('paymentId') paymentId: string) {
    const refunds = await this.refundsService.findByPayment(paymentId);
    return success(refunds);
  }

  @Get('by-booking/:bookingId')
  async findByBooking(@Param('bookingId') bookingId: string) {
    const refunds = await this.refundsService.findByBooking(bookingId);
    return success(refunds);
  }
}
