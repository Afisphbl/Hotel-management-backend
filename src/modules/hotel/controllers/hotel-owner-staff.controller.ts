import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { HotelOwnerStaffService } from '../services/hotel-owner-staff.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { HotelAccessStatus } from '../../../database/entities/hotel-user-access.entity';
import { success } from '../common/response.interceptor';

@Controller('hotel/owner/staff')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard)
@Scopes(UserScope.HOTEL)
export class HotelOwnerStaffController {
  constructor(private readonly ownerStaffService: HotelOwnerStaffService) {}

  @Get()
  async findAll(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    const result = await this.ownerStaffService.findAll(req.user.hotel_id, {
      page: page || 1,
      limit: limit || 10,
      status,
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

  @Get('roles')
  async getRoles(@Request() req: any) {
    const roles = await this.ownerStaffService.getAvailableRoles(req.user.hotel_id);
    return success(roles);
  }

  @Get('summary')
  async getSummary(@Request() req: any) {
    const summary = await this.ownerStaffService.getSummary(req.user.hotel_id);
    return success(summary);
  }

  @Post('invite')
  async invite(@Request() req: any, @Body() data: { email: string; firstName: string; lastName: string; roleId: string; notes?: string }) {
    const result = await this.ownerStaffService.invite(req.user.hotel_id, data);
    return success(result);
  }

  @Patch(':id/role')
  async updateRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body('roleId') roleId: string,
  ) {
    const result = await this.ownerStaffService.updateRole(id, req.user.hotel_id, roleId);
    return success(result);
  }

  @Patch(':id/status')
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: HotelAccessStatus,
  ) {
    const result = await this.ownerStaffService.updateStatus(id, req.user.hotel_id, status);
    return success(result);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    const result = await this.ownerStaffService.remove(id, req.user.hotel_id);
    return success(result);
  }
}
