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
import { MaintenanceService } from '../services/maintenance.service';
import { TicketPriority, TicketStatus } from '../../../database/entities/maintenance-ticket.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/maintenance')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  @Get()
  async findAll(
    @Query() query: PaginationDto & { status?: TicketStatus; priority?: TicketPriority; roomId?: string; assignedTo?: string },
  ) {
    const result = await this.maintenanceService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const ticket = await this.maintenanceService.findById(id);
    return success(ticket);
  }

  @Post()
  async create(@Body() data: any) {
    const ticket = await this.maintenanceService.create(data);
    return success(ticket);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const ticket = await this.maintenanceService.update(id, data);
    return success(ticket);
  }

  @Post(':id/assign')
  async assign(@Param('id') id: string, @Body('staffId') staffId: string) {
    const ticket = await this.maintenanceService.assign(id, staffId);
    return success(ticket);
  }

  @Post(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @Body() data: { notes?: string; cost?: number },
  ) {
    const ticket = await this.maintenanceService.resolve(id, data.notes, data.cost);
    return success(ticket);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.maintenanceService.remove(id);
    return success({ deleted: true });
  }
}
