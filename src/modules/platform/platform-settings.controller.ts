import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { SettingCategory } from '../../database/entities/global/global-setting.entity';

@Controller('platform/settings')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformSettingsController {
  constructor(private platformService: PlatformService) {}

  @Get()
  async getSettings() {
    return this.platformService.findAllSettings();
  }

  @Post()
  async updateSetting(
    @Body('key') key: string,
    @Body('value') value: any,
    @Body('category') category: SettingCategory,
  ) {
    return this.platformService.updateSetting(key, value, category);
  }

  @Delete(':key')
  async deleteSetting(@Param('key') key: string) {
    return this.platformService.deleteSetting(key);
  }
}
