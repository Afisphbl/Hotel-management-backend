import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ShiftsService } from '../services/shifts.service';
import { ShiftStatus } from '../../../database/entities/shift.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/shifts')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & {
      staffId?: string;
      status?: ShiftStatus;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const result = await this.shiftsService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const shift = await this.shiftsService.findById(id);
    return success(shift);
  }

  @Post()
  async create(@Body() data: any) {
    const shift = await this.shiftsService.create(data);
    return success(shift);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const shift = await this.shiftsService.update(id, data);
    return success(shift);
  }

  @Post(':id/check-in')
  async checkIn(@Param('id') id: string) {
    const shift = await this.shiftsService.checkIn(id);
    return success(shift);
  }

  @Post(':id/check-out')
  async checkOut(@Param('id') id: string) {
    const shift = await this.shiftsService.checkOut(id);
    return success(shift);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    const shift = await this.shiftsService.cancel(id);
    return success(shift);
  }
}
