import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { PlatformService } from './platform.service';
import { SettingCategory } from '../../database/entities/global/global-setting.entity';

@Controller('platform/monitoring')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformMonitoringController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly platformService: PlatformService,
  ) {}

  @Get('health')
  async health() {
    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      database: 'ok',
      hotels: (await this.platformService.findAllHotels()).length,
      subscriptions: (await this.platformService.findAllSubscriptions()).length,
      maintenanceMode:
        (await this.platformService.findAllSettings()).find(
          (setting) => setting.key === 'system:maintenance_mode',
        )?.value === true,
      timestamp: new Date(),
    };
  }

  @Get('maintenance-notice')
  async getMaintenanceNotice() {
    const settings = await this.platformService.findAllSettings();
    return {
      notice:
        settings.find((setting) => setting.key === 'system:maintenance_notice')
          ?.value ?? null,
    };
  }

  @Patch('maintenance-notice')
  async updateMaintenanceNotice(@Body('notice') notice: string) {
    return this.platformService.updateSetting(
      'system:maintenance_notice',
      notice,
      SettingCategory.SYSTEM,
    );
  }

  @Patch('maintenance-mode')
  async updateMaintenanceMode(@Body('enabled') enabled: boolean) {
    return this.platformService.updateSetting(
      'system:maintenance_mode',
      enabled,
      SettingCategory.SYSTEM,
    );
  }
}
