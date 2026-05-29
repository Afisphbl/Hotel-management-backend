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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { UserManagementService } from './user-management.service';
import {
  UserStatus,
  UserRole,
} from '../../database/entities/global/platform-user.entity';

@Controller('platform/users')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformUsersManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get()
  async findAll(
    @Query('status') status?: UserStatus,
    @Query('roleId') roleId?: string,
    @Query('search') search?: string,
  ) {
    return this.userManagementService.findAll({ status, roleId, search });
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.userManagementService.findUserById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() data: any) {
    return this.userManagementService.createUser(data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.userManagementService.updateUser(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.userManagementService.deleteUser(id);
    return { success: true };
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.userManagementService.deactivateUser(
      id,
      reason,
      'platform_admin',
    );
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    return this.userManagementService.activateUser(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.userManagementService.suspendUser(id, reason);
  }

  @Post(':id/reset-lockout')
  @HttpCode(HttpStatus.OK)
  async resetLockout(@Param('id') id: string) {
    await this.userManagementService.resetLockout(id);
    return { success: true };
  }

  @Post(':id/change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Param('id') id: string,
    @Body() data: { currentPassword: string; newPassword: string },
  ) {
    await this.userManagementService.changePassword(
      id,
      data.currentPassword,
      data.newPassword,
    );
    return { success: true };
  }

  @Get('role/:roleName')
  async getByRole(@Param('roleName') roleName: UserRole) {
    return this.userManagementService.getUsersByRole(roleName);
  }

  @Get('lockout/config')
  async getLockoutConfig() {
    return this.userManagementService.getLockoutConfig();
  }

  @Post('lockout/config')
  @HttpCode(HttpStatus.OK)
  async updateLockoutConfig(@Body() config: any) {
    return this.userManagementService.updateLockoutConfig(config);
  }
}
