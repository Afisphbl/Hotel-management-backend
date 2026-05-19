import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StaffService } from '../services/staff.service';
import {
  StaffRole,
  StaffStatus,
} from '../../../database/entities/staff.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import {
  CreateStaffDto,
  UpdateStaffDto,
  QueryStaffDto,
} from '../dto/staff.dto';
import { success, paginatedResponse } from '../../../common/pagination';

@Controller('staff')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  async findAll(@Query() query: QueryStaffDto) {
    const result = await this.staffService.findAll(query);
    return paginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const staff = await this.staffService.findById(id);
    return success(staff);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateStaffDto) {
    const staff = await this.staffService.create(dto);
    return success(staff);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    const staff = await this.staffService.update(id, dto);
    return success(staff);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.staffService.remove(id);
  }
}
