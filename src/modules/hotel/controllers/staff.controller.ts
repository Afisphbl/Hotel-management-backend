import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { StaffService } from '../services/staff.service';
import { StaffRole, StaffStatus } from '../../../database/entities/staff.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';
import { PlanLimitGuard } from '../../../auth/guards/plan-limit.guard';
import { PlanLimit } from '../../../common/decorators/plan-limit.decorator';
import { TenantQuotaService } from '../../../common/services/tenant-quota.service';

@Controller('hotel/staff')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class StaffController {
  constructor(
    private staffService: StaffService,
    private readonly tenantQuotaService: TenantQuotaService,
  ) {}

  private hotelId(req: any): string {
    return req.user.hotel_id || req.user.hotelId;
  }

  @Get()
  async findAll(@Request() req: any, @Query() query: PaginationDto & { role?: StaffRole; status?: StaffStatus; department?: string }) {
    const result = await this.staffService.findAll(this.hotelId(req), query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Request() req: any) {
    return success(await this.staffService.findById(id, this.hotelId(req)));
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  @PlanLimit('users')
  async create(@Body() data: any, @Request() req: any) {
    const staff = await this.staffService.create(data, this.hotelId(req));
    await this.tenantQuotaService.syncQuotaSnapshot(this.hotelId(req));
    return success(staff);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return success(await this.staffService.update(id, data, this.hotelId(req)));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.staffService.remove(id, this.hotelId(req));
    await this.tenantQuotaService.syncQuotaSnapshot(this.hotelId(req));
    return success({ deleted: true });
  }
}
