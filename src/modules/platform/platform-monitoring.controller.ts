import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { PlatformService } from './platform.service';
import { SystemMonitoringService } from './system-monitoring.service';
import { SettingCategory } from '../../database/entities/global/global-setting.entity';
import { MaintenanceWindowStatus } from '../../database/entities/global/maintenance-window.entity';
import { UptimeStatus } from '../../database/entities/global/uptime-record.entity';

@Controller('platform/monitoring')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformMonitoringController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly platformService: PlatformService,
    private readonly monitoringService: SystemMonitoringService,
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

  @Get('health/detailed')
  async detailedHealth() {
    return this.monitoringService.getDetailedHealth();
  }

  @Get('system')
  async systemInfo() {
    return this.monitoringService.getSystemInfo();
  }

  @Get('metrics')
  async systemMetrics() {
    return this.monitoringService.getSystemMetrics();
  }

  @Get('uptime')
  async uptimeHistory(@Query('hours') hours?: string) {
    const h = hours ? parseInt(hours, 10) : 24;
    return this.monitoringService.getUptimeHistory(h);
  }

  @Get('uptime/summary')
  async uptimeSummary() {
    return this.monitoringService.getUptimeSummary();
  }

  @Post('uptime/record')
  async recordUptimeCheck(
    @Body('component') component: string,
    @Body('status') status: UptimeStatus,
    @Body('responseTimeMs') responseTimeMs: number,
    @Body('message') message?: string,
  ) {
    return this.monitoringService.recordUptimeCheck(
      component,
      status,
      responseTimeMs,
      message,
    );
  }

  @Get('maintenance-windows')
  async getMaintenanceWindows(
    @Query('status') status?: MaintenanceWindowStatus,
    @Query('hotelId') hotelId?: string,
  ) {
    return this.monitoringService.getMaintenanceWindows(status, hotelId);
  }

  @Get('maintenance-windows/active')
  async getActiveMaintenanceWindows() {
    return this.monitoringService.getActiveMaintenanceWindows();
  }

  @Post('maintenance-windows')
  async createMaintenanceWindow(
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('startsAt') startsAt: string,
    @Body('endsAt') endsAt: string,
    @Body('isGlobal') isGlobal: boolean,
    @Body('hotelId') hotelId: string,
    @Body('affectedComponents') affectedComponents: string[],
    @Body('createdBy') createdBy: string,
  ) {
    return this.monitoringService.createMaintenanceWindow({
      title,
      description,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      isGlobal,
      hotelId,
      affectedComponents,
      createdBy,
    });
  }

  @Patch('maintenance-windows/:id/status')
  async updateMaintenanceWindowStatus(
    @Param('id') id: string,
    @Body('status') status: MaintenanceWindowStatus,
  ) {
    return this.monitoringService.updateMaintenanceWindowStatus(id, status);
  }

  @Post('maintenance-windows/:id/cancel')
  async cancelMaintenanceWindow(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.monitoringService.cancelMaintenanceWindow(id, reason);
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
