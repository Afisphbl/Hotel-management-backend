import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { PlatformService } from './platform.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformRolesController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('roles')
  async getRoles() {
    return this.platformService.getPlatformRoles();
  }

  @Get('roles/summary')
  async getRolesSummary() {
    return this.platformService.getPlatformRolesSummary();
  }

  @Get('permissions')
  async getPermissions() {
    return this.platformService.getPlatformPermissionsList();
  }
}
