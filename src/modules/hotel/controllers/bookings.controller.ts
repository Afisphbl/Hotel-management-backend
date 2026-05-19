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
} from '@nestjs/common';
import {
  BookingsService,
  CreateBookingDto,
  ConfirmBookingDto,
  CancelBookingDto,
} from '../services/bookings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { BookingStatus } from '../../../database/entities/booking.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

class CreateBookingBodyDto {
  @IsUUID() guestId: string;
  @IsUUID('4', { each: true }) @IsArray() @ArrayMinSize(1) roomIds: string[];
  @IsString() @IsNotEmpty() checkIn: string;
  @IsString() @IsNotEmpty() checkOut: string;
  @IsString() @IsNotEmpty() idempotencyKey: string;
  @IsOptional() metadata?: Record<string, unknown>;
}

class ConfirmBookingBodyDto {
  @IsString() @IsNotEmpty() idempotencyKey: string;
}

@Controller('hotel/bookings')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & {
      status?: BookingStatus;
      guestId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const result = await this.bookingsService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const booking = await this.bookingsService.findById(id);
    return success(booking);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateBookingBodyDto, @Request() req: any) {
    const booking = await this.bookingsService.create(
      { ...dto, roomIds: dto.roomIds },
      req.user.userId,
    );
    return success(booking);
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmBookingBodyDto,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.confirm(
      id,
      dto,
      req.user.userId,
    );
    return success(booking);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.cancel(id, dto, req.user.userId);
    return success(booking);
  }

  @Post(':id/checkin')
  async checkin(@Param('id') id: string, @Request() req: any) {
    const booking = await this.bookingsService.checkin(id, req.user.userId);
    return success(booking);
  }

  @Post(':id/checkout')
  async checkout(@Param('id') id: string, @Request() req: any) {
    const booking = await this.bookingsService.checkout(id, req.user.userId);
    return success(booking);
  }
}
