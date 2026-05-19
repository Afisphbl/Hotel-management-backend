import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from '../services/invoices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { InvoiceStatus } from '../../../database/entities/invoice.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/invoices')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & { status?: InvoiceStatus; bookingId?: string },
  ) {
    const result = await this.invoicesService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const invoice = await this.invoicesService.findById(id);
    return success(invoice);
  }

  @Post(':id/issue')
  async issue(@Param('id') id: string) {
    const invoice = await this.invoicesService.issue(id);
    return success(invoice);
  }

  @Post(':id/void')
  async void(@Param('id') id: string) {
    const invoice = await this.invoicesService.void(id);
    return success(invoice);
  }
}
