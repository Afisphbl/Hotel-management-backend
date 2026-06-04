import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { HotelManagementService } from '../services/hotel-management.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { CreateHotelDto, UpdateHotelDto } from '../dto/hotel-management.dto';
import { success } from '../common/response.interceptor';

@Controller('hotel/owner/hotels')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.HOTEL)
export class HotelManagementController {
  constructor(
    private readonly hotelManagementService: HotelManagementService,
  ) {}

  @Get()
  async findAll(@Request() req: any) {
    const ownerEmail = req.user?.email;
    const hotels = await this.hotelManagementService.findByOwner(ownerEmail);
    return success(hotels);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const hotel = await this.hotelManagementService.findOne(id);
    return success(hotel);
  }

  @Post()
  async create(@Body() dto: CreateHotelDto, @Request() req: any) {
    (dto as any).ownerEmail = req.user?.email;
    const hotel = await this.hotelManagementService.create(dto);
    return success(hotel);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateHotelDto) {
    const hotel = await this.hotelManagementService.update(id, dto);
    return success(hotel);
  }

  @Patch(':id/activate')
  async setActive(@Param('id') id: string, @Body('active') active: boolean) {
    const hotel = await this.hotelManagementService.setActive(id, active);
    return success(hotel);
  }

  @Post(':id/branding')
  async updateBranding(
    @Param('id') id: string,
    @Body('branding') branding: any,
  ) {
    const hotel = await this.hotelManagementService.updateBranding(
      id,
      branding,
    );
    return success(hotel);
  }
}
