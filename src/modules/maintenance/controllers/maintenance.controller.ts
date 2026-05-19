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
import { MaintenanceService } from '../services/maintenance.service';
import {
  TicketPriority,
  TicketStatus,
} from '../../../database/entities/maintenance-ticket.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import {
  CreateTicketDto,
  UpdateTicketDto,
  ResolveTicketDto,
  QueryTicketDto,
} from '../dto/maintenance.dto';
import { success, paginatedResponse } from '../../../common/pagination';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  @Get()
  async findAll(@Query() query: QueryTicketDto) {
    const result = await this.maintenanceService.findAll(query);
    return paginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const ticket = await this.maintenanceService.findById(id);
    return success(ticket);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTicketDto) {
    const ticket = await this.maintenanceService.create(dto);
    return success(ticket);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    const ticket = await this.maintenanceService.update(id, dto);
    return success(ticket);
  }

  @Post(':id/assign')
  async assign(@Param('id') id: string, @Body('staffId') staffId: string) {
    const ticket = await this.maintenanceService.assign(id, staffId);
    return success(ticket);
  }

  @Post(':id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveTicketDto) {
    const ticket = await this.maintenanceService.resolve(
      id,
      dto.notes,
      dto.cost,
    );
    return success(ticket);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.maintenanceService.remove(id);
  }
}
