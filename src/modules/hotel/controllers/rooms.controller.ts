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
import { PlanLimit } from '../../../common/decorators/plan-limit.decorator';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { RoomStatus } from '../../../database/entities/room.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';
import { TenantQuotaService } from '../../../common/services/tenant-quota.service';

@Controller('hotel/rooms')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class RoomsController {
  constructor(
    private roomsService: RoomsService,
    private readonly tenantQuotaService: TenantQuotaService,
  ) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query()
    query: PaginationDto & {
      status?: RoomStatus;
      floor?: string;
      roomTypeId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const hotelId = req.user.hotel_id;
    const result = await this.roomsService.findAll(hotelId, {
      ...query,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get('availability')
  async getAvailability(
    @Request() req: any,
    @Query('roomTypeId') roomTypeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const hotelId = req.user.hotel_id;
    const result = await this.roomsService.getAvailability(
      hotelId,
      roomTypeId,
      startDate,
      endDate,
    );
    return success(result);
  }

  @Get('summary')
  async getSummary(@Request() req: any) {
    const hotelId = req.user.hotel_id;
    const summary = await this.roomsService.getSummary(hotelId);
    return success(summary);
  }

  @Get('booked-dates')
  async getBookedDates(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const hotelId = req.user.hotel_id;
    const dates = await this.roomsService.getFullyBookedDates(hotelId, startDate, endDate);
    return success(dates);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Request() req: any) {
    const hotelId = req.user.hotel_id;
    const room = await this.roomsService.findById(id, hotelId);
    return success(room);
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  @PlanLimit('rooms')
  async create(@Body() data: any, @Request() req: any) {
    const hotelId = req.user.hotel_id;
    const room = await this.roomsService.create(data, hotelId);
    await this.tenantQuotaService.syncQuotaSnapshot(hotelId);
    return success(room);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    const hotelId = req.user.hotel_id;
    const room = await this.roomsService.update(id, data, hotelId);
    return success(room);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: RoomStatus,
    @Request() req: any,
  ) {
    const hotelId = req.user.hotel_id;
    const room = await this.roomsService.updateStatus(id, status, hotelId);
    return success(room);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const hotelId = req.user.hotel_id;
    await this.roomsService.remove(id, hotelId);
    await this.tenantQuotaService.syncQuotaSnapshot(hotelId);
    return success({ deleted: true });
  }
}
