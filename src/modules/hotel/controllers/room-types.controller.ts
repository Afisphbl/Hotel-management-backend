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
} from '@nestjs/common';
import { RoomTypesService } from '../services/room-types.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Scopes } from '../../../common/decorators/scopes.decorator';
import { UserScope } from '../../../database/entities/user.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { success, paginated } from '../common/response.interceptor';

@Controller('hotel/room-types')
@UseGuards(JwtAuthGuard, ScopeGuard, TenantGuard, PermissionsGuard)
@Scopes(UserScope.HOTEL)
export class RoomTypesController {
  constructor(private roomTypesService: RoomTypesService) {}

  @Get()
  async findAll(@Query() query: PaginationDto) {
    const result = await this.roomTypesService.findAll(query);
    return paginated(result.items, result.total, result.page, result.limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const type = await this.roomTypesService.findById(id);
    return success(type);
  }

  @Post()
  async create(@Body() data: any) {
    const type = await this.roomTypesService.create(data);
    return success(type);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const type = await this.roomTypesService.update(id, data);
    return success(type);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.roomTypesService.remove(id);
    return success({ deleted: true });
  }
}
