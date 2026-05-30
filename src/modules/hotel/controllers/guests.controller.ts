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
import { GuestsService } from '../services/guests.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { RequirePiiPermission } from '../../../common/decorators/pii.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/guests')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class GuestsController {
  constructor(private guestsService: GuestsService) {}

  @Get()
  async findAll(
    @Query()
    query: PaginationDto & {
      search?: string;
      email?: string;
      isVip?: string;
      nationality?: string;
      recent?: string;
    },
  ) {
    const options = {
      ...query,
      isVip: query.isVip === 'true' ? true : query.isVip === 'false' ? false : undefined,
      recent: query.recent === 'true',
    };
    const result = await this.guestsService.findAll(options);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  @RequirePiiPermission('guests:pii:read')
  async findById(@Param('id') id: string, @Request() req: any) {
    const guest = await this.guestsService.findById(id);
    const hasPii = req.user.permissions?.includes('guests:pii:read');
    return success(hasPii ? guest : guest.toSafeDTO());
  }

  @Post()
  async create(@Body() data: any) {
    const guest = await this.guestsService.create(data);
    return success(guest);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const guest = await this.guestsService.update(id, data);
    return success(guest);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.guestsService.remove(id);
    return success({ deleted: true });
  }
}
