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
import { InvoicesService } from '../services/invoices.service';
import { InvoiceStatus } from '../../../database/entities/invoice.entity';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { CreateInvoiceDto, QueryInvoiceDto } from '../dto/invoice.dto';
import { success, paginated } from '../common/response';

@Controller('finance/invoices')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  async findAll(@Query() query: QueryInvoiceDto) {
    const result = await this.invoicesService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const invoice = await this.invoicesService.findById(id);
    return success(invoice);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateInvoiceDto) {
    const invoice = await this.invoicesService.createForBooking(dto);
    return success(invoice);
  }

  @Post(':id/issue')
  async issue(@Param('id') id: string) {
    const invoice = await this.invoicesService.issue(id);
    return success(invoice);
  }

  @Post(':id/paid')
  async markPaid(@Param('id') id: string) {
    const invoice = await this.invoicesService.markPaid(id);
    return success(invoice);
  }

  @Post(':id/overdue')
  async markOverdue(@Param('id') id: string) {
    const invoice = await this.invoicesService.markOverdue(id);
    return success(invoice);
  }

  @Post(':id/void')
  async void(@Param('id') id: string) {
    const invoice = await this.invoicesService.void(id);
    return success(invoice);
  }
}
