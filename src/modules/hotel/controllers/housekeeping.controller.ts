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
  Request,
} from '@nestjs/common';
import { HousekeepingService } from '../services/housekeeping.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { CreateHousekeepingDto, UpdateHousekeepingDto } from '../dto/housekeeping.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/housekeeping')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class HousekeepingController {
  constructor(private housekeepingService: HousekeepingService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query()
    query: PaginationDto & {
      status?: string;
      assignedTo?: string;
      priority?: string;
      roomId?: string;
    },
  ) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const result = await this.housekeepingService.findAll(hotelId, query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Request() req: any) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const task = await this.housekeepingService.findById(id, hotelId);
    return success(task);
  }

  @Post()
  async create(@Body() dto: CreateHousekeepingDto, @Request() req: any) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const task = await this.housekeepingService.create(hotelId, dto);
    return success(task);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingDto,
    @Request() req: any,
  ) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const task = await this.housekeepingService.update(id, dto, hotelId);
    return success(task);
  }

  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body('staffId') staffId: string,
    @Request() req: any,
  ) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const task = await this.housekeepingService.assign(id, staffId, hotelId);
    return success(task);
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Request() req: any,
  ) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    const task = await this.housekeepingService.complete(id, notes, hotelId);
    return success(task);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const hotelId = req.user.hotel_id || req.user.hotelId;
    await this.housekeepingService.remove(id, hotelId);
    return success({ deleted: true });
  }
}
