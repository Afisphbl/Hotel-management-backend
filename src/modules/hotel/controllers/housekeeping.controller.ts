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
import { HousekeepingService } from '../services/housekeeping.service';
import { TaskPriority, TaskStatus } from '../../../database/entities/housekeeping-task.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/housekeeping')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class HousekeepingController {
  constructor(private housekeepingService: HousekeepingService) {}

  @Get()
  async findAll(
    @Query() query: PaginationDto & { status?: TaskStatus; assignedTo?: string; priority?: TaskPriority; roomId?: string },
  ) {
    const result = await this.housekeepingService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const task = await this.housekeepingService.findById(id);
    return success(task);
  }

  @Post()
  async create(@Body() data: any) {
    const task = await this.housekeepingService.create(data);
    return success(task);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const task = await this.housekeepingService.update(id, data);
    return success(task);
  }

  @Post(':id/assign')
  async assign(@Param('id') id: string, @Body('staffId') staffId: string) {
    const task = await this.housekeepingService.assign(id, staffId);
    return success(task);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @Body('notes') notes?: string) {
    const task = await this.housekeepingService.complete(id, notes);
    return success(task);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.housekeepingService.remove(id);
    return success({ deleted: true });
  }
}
