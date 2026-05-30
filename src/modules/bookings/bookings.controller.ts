import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { BookingStatus } from '../../database/entities/booking.entity';
import {
  CreateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
  QueryBookingsDto,
} from './dto/create-booking.dto';

@Controller('hotel/bookings')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get()
  async findAll(@Query() query: QueryBookingsDto) {
    const result = await this.bookingsService.findAll({
      page: query.page,
      limit: query.limit,
      status: query.status as BookingStatus,
      guestId: query.guestId,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const booking = await this.bookingsService.findById(id);
    return { success: true, data: booking };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBookingDto, @Request() req: any) {
    const booking = await this.bookingsService.createBooking({
      guestId: dto.guestId,
      roomIds: dto.roomIds,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      idempotencyKey: dto.idempotencyKey,
      source: dto.source,
      notes: dto.notes,
      metadata: dto.metadata,
      userId: req.user.userId,
    });
    return { success: true, data: booking };
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id') id: string,
    @Body() _dto: ConfirmBookingDto,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.confirm(
      id,
      _dto.idempotencyKey,
      req.user.userId,
    );
    return { success: true, data: booking };
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.cancel(
      id,
      dto.reason,
      req.user.userId,
    );
    return { success: true, data: booking };
  }

  @Post(':id/checkin')
  async checkin(@Param('id') id: string, @Request() req: any) {
    const booking = await this.bookingsService.checkin(id, req.user.userId);
    return { success: true, data: booking };
  }

  @Post(':id/checkout')
  async checkout(@Param('id') id: string, @Request() req: any) {
    const booking = await this.bookingsService.checkout(id, req.user.userId);
    return { success: true, data: booking };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: { status: BookingStatus },
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.transitionStatus(
      id,
      dto.status,
      req.user.userId,
    );
    return { success: true, data: booking };
  }
}
