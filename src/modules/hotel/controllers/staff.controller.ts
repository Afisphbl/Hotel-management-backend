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
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/staff')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & {
      role?: StaffRole;
      status?: StaffStatus;
      department?: string;
    },
  ) {
    const result = await this.staffService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const staff = await this.staffService.findById(id);
    return success(staff);
  }

  @Post()
  async create(@Body() data: any) {
    const staff = await this.staffService.create(data);
    return success(staff);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const staff = await this.staffService.update(id, data);
    return success(staff);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.staffService.remove(id);
    return success({ deleted: true });
  }
}
