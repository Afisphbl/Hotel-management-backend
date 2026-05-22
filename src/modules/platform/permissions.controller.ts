import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PermissionsService } from '../../common/services/permissions.service';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  PermissionQueryDto,
  PermissionAssignmentDto,
  BulkPermissionAssignmentDto,
} from '../../common/dto/permissions.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';

@Controller('platform/permissions')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  async findAll(@Query() query?: PermissionQueryDto) {
    return this.permissionsService.findAll(query);
  }

  @Get('predefined')
  async getPredefinedPermissions() {
    return this.permissionsService.createPredefinedPermissions();
  }

  @Get('predefined-roles')
  async getPredefinedRoles() {
    return this.permissionsService.getPredefinedRoles();
  }

  @Post('bootstrap')
  @HttpCode(HttpStatus.CREATED)
  async bootstrapAccessControl() {
    return this.permissionsService.bootstrapPredefinedAccessControl();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.permissionsService.remove(id);
    return { success: true };
  }

  @Post('assign')
  @HttpCode(HttpStatus.CREATED)
  async assignPermission(@Body() assignmentDto: PermissionAssignmentDto) {
    return this.permissionsService.assignPermission(assignmentDto);
  }

  @Post('bulk-assign')
  @HttpCode(HttpStatus.CREATED)
  async bulkAssignPermissions(
    @Body() bulkAssignmentDto: BulkPermissionAssignmentDto,
  ) {
    return this.permissionsService.bulkAssignPermissions(bulkAssignmentDto);
  }

  @Delete('revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePermission(
    @Body() body: { roleId: string; permissionId: string },
  ) {
    const { roleId, permissionId } = body;
    await this.permissionsService.revokePermission(roleId, permissionId);
    return { success: true };
  }

  @Get('roles/:roleId/permissions')
  async getRolePermissions(@Param('roleId') roleId: string) {
    return this.permissionsService.getRolePermissions(roleId);
  }

  @Get('roles/:roleId/permission-slugs')
  async getRolePermissionSlugs(@Param('roleId') roleId: string) {
    return this.permissionsService.getRolePermissionSlugs(roleId);
  }

  @Get('users/:userId/permissions')
  async getUserPermissions(
    @Param('userId') userId: string,
    @Query('hotelId') hotelId?: string,
  ) {
    return this.permissionsService.getUserPermissions(userId, hotelId);
  }
}
