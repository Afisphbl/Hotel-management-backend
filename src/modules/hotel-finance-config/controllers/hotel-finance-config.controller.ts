import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { HotelFinanceConfigService } from '../services/hotel-finance-config.service';
import { UpdateHotelFinanceConfigDto } from '../dto/hotel-finance-config.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';

@Controller('hotel/finance-config')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard)
@Scopes(UserScope.HOTEL)
export class HotelFinanceConfigController {
  constructor(private readonly configService: HotelFinanceConfigService) {}

  @Get()
  async getConfig(@Request() req: any) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    return await this.configService.getConfig(hotelId);
  }

  @Patch()
  async updateConfig(
    @Request() req: any,
    @Body() dto: UpdateHotelFinanceConfigDto,
  ) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    return await this.configService.updateConfig(hotelId, dto);
  }

  // Tax Management Endpoints (specific for this config module)
  @Post('taxes')
  async addTaxRule(@Request() req: any, @Body() dto: any) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    return await this.configService.addTaxRule(hotelId, dto);
  }

  @Patch('taxes/:id')
  async updateTaxRule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    return await this.configService.updateTaxRule(hotelId, id, dto);
  }

  @Delete('taxes/:id')
  async removeTaxRule(@Request() req: any, @Param('id') id: string) {
    const hotelId = req.user.hotelId || req.user.hotel_id;
    return await this.configService.removeTaxRule(hotelId, id);
  }
}
