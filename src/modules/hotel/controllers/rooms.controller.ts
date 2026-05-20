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
import { RoomsService } from '../services/rooms.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PlanLimitGuard } from '../../../auth/guards/plan-limit.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { RoomStatus } from '../../../database/entities/room.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/rooms')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & {
      status?: RoomStatus;
      floor?: string;
      roomTypeId?: string;
    },
  ) {
    const result = await this.roomsService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get('availability')
  async getAvailability(
    @Query('roomTypeId') roomTypeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const result = await this.roomsService.getAvailability(
      roomTypeId,
      startDate,
      endDate,
    );
    return success(result);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const room = await this.roomsService.findById(id);
    return success(room);
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  async create(@Body() data: any) {
    const room = await this.roomsService.create(data);
    return success(room);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const room = await this.roomsService.update(id, data);
    return success(room);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: RoomStatus,
  ) {
    const room = await this.roomsService.updateStatus(id, status);
    return success(room);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.roomsService.remove(id);
    return success({ deleted: true });
  }
}
