import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShiftsService } from '../services/shifts.service';
import { ShiftStatus } from '../../../database/entities/shift.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import {
  CreateShiftDto,
  UpdateShiftDto,
  QueryShiftDto,
} from '../dto/shift.dto';
import { success, paginatedResponse } from '../../../common/pagination';

@Controller('shifts')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get()
  async findAll(@Query() query: QueryShiftDto) {
    const result = await this.shiftsService.findAll(query);
    return paginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const shift = await this.shiftsService.findById(id);
    return success(shift);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateShiftDto) {
    const shift = await this.shiftsService.create(dto);
    return success(shift);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    const shift = await this.shiftsService.update(id, dto);
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
