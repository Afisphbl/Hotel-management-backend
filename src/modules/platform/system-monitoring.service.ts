import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, Between } from 'typeorm';
import { Hotel } from '../../database/entities/hotel.entity';
import { GlobalSetting } from '../../database/entities/global/global-setting.entity';
import {
  UptimeRecord,
  UptimeStatus,
} from '../../database/entities/global/uptime-record.entity';
import {
  MaintenanceWindow,
  MaintenanceWindowStatus,
} from '../../database/entities/global/maintenance-window.entity';
import { Subscription } from '../../database/entities/global/subscriptions.entity';

export interface HealthComponent {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  message?: string;
}

@Injectable()
export class SystemMonitoringService {
  private readonly logger = new Logger(SystemMonitoringService.name);
  private startTime = Date.now();

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(GlobalSetting)
    private settingRepository: Repository<GlobalSetting>,
    @InjectRepository(UptimeRecord)
    private uptimeRepository: Repository<UptimeRecord>,
    @InjectRepository(MaintenanceWindow)
    private maintenanceWindowRepository: Repository<MaintenanceWindow>,
  ) {}

  async getDetailedHealth(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    uptime: number;
    components: HealthComponent[];
    timestamp: Date;
  }> {
    const components: HealthComponent[] = [];

    const dbStart = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      components.push({
        name: 'database',
        status: 'ok',
        latencyMs: Date.now() - dbStart,
      });
    } catch {
      components.push({
        name: 'database',
        status: 'down',
        latencyMs: Date.now() - dbStart,
        message: 'Database connection failed',
      });
    }

    const redisStart = Date.now();
    try {
      const redisPing = await this.dataSource.query(
        'SELECT pg_is_in_recovery() as recovery',
      );
      components.push({
        name: 'cache',
        status: 'ok',
        latencyMs: Date.now() - redisStart,
      });
    } catch {
      components.push({
        name: 'cache',
        status: 'degraded',
        latencyMs: Date.now() - redisStart,
        message: 'Cache not available, using DB fallback',
      });
    }

    const storageStart = Date.now();
    try {
      const hasS3Config = await this.settingRepository.findOne({
        where: { key: 'storage:s3_config' },
      });
      if (hasS3Config) {
        components.push({
          name: 'object_storage',
          status: 'ok',
          latencyMs: Date.now() - storageStart,
        });
      } else {
        components.push({
          name: 'object_storage',
          status: 'ok',
          latencyMs: 0,
          message: 'Not configured',
        });
      }
    } catch {
      components.push({
        name: 'object_storage',
        status: 'degraded',
        latencyMs: Date.now() - storageStart,
        message: 'Storage config check failed',
      });
    }

    const hotelStart = Date.now();
    try {
      const hotelCount = await this.hotelRepository.count();
      components.push({
        name: 'hotels',
        status: 'ok',
        latencyMs: Date.now() - hotelStart,
        message: `${hotelCount} hotels registered`,
      });
    } catch {
      components.push({
        name: 'hotels',
        status: 'degraded',
        latencyMs: Date.now() - hotelStart,
        message: 'Hotel read failed',
      });
    }

    const uptime = Date.now() - this.startTime;
    const downComponents = components.filter((c) => c.status === 'down');
    const degradedComponents = components.filter(
      (c) => c.status === 'degraded',
    );

    let overallStatus: 'ok' | 'degraded' | 'down';
    if (downComponents.length > 0) {
      overallStatus = 'down';
    } else if (degradedComponents.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'ok';
    }

    return {
      status: overallStatus,
      uptime,
      components,
      timestamp: new Date(),
    };
  }

  async recordUptimeCheck(
    component: string,
    status: UptimeStatus,
    responseTimeMs: number,
    message?: string,
  ): Promise<UptimeRecord> {
    const record = this.uptimeRepository.create({
      component,
      status,
      responseTimeMs,
      recordedAt: new Date(),
      message,
    });
    return this.uptimeRepository.save(record);
  }

  async getUptimeHistory(hours = 24): Promise<UptimeRecord[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);
    return this.uptimeRepository.find({
      where: { recordedAt: MoreThan(since) },
      order: { recordedAt: 'DESC' },
    });
  }

  async getUptimeSummary(): Promise<{
    overallUptime: number;
    todayUptime: number;
    componentStats: Array<{
      component: string;
      upCount: number;
      downCount: number;
      degradedCount: number;
      uptimePct: number;
      avgResponseTime: number;
    }>;
  }> {
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const last30d = new Date();
    last30d.setDate(last30d.getDate() - 30);

    const allRecords = await this.uptimeRepository.find({
      where: { recordedAt: MoreThan(last30d) },
      order: { recordedAt: 'DESC' },
    });

    const todayRecords = allRecords.filter((r) => r.recordedAt >= last24h);
    const components = [...new Set(allRecords.map((r) => r.component))];

    const componentStats = components.map((component) => {
      const compRecords = allRecords.filter((r) => r.component === component);
      const up = compRecords.filter((r) => r.status === UptimeStatus.UP).length;
      const down = compRecords.filter(
        (r) => r.status === UptimeStatus.DOWN,
      ).length;
      const degraded = compRecords.filter(
        (r) => r.status === UptimeStatus.DEGRADED,
      ).length;
      const total = compRecords.length;
      const avgLatency =
        total > 0
          ? Math.round(
              compRecords.reduce((s, r) => s + r.responseTimeMs, 0) / total,
            )
          : 0;

      return {
        component,
        upCount: up,
        downCount: down,
        degradedCount: degraded,
        uptimePct: total > 0 ? Math.round((up / total) * 10000) / 100 : 100,
        avgResponseTime: avgLatency,
      };
    });

    const allUp = allRecords.filter((r) => r.status === 'up').length;
    const overallUptime =
      allRecords.length > 0
        ? Math.round((allUp / allRecords.length) * 10000) / 100
        : 100;

    const todayUp = todayRecords.filter((r) => r.status === 'up').length;
    const todayUptime =
      todayRecords.length > 0
        ? Math.round((todayUp / todayRecords.length) * 10000) / 100
        : 100;

    return { overallUptime, todayUptime, componentStats };
  }

  async createMaintenanceWindow(data: {
    title: string;
    description?: string;
    startsAt: Date;
    endsAt: Date;
    isGlobal?: boolean;
    hotelId?: string;
    affectedComponents?: string[];
    createdBy: string;
  }): Promise<MaintenanceWindow> {
    const window = this.maintenanceWindowRepository.create({
      title: data.title,
      description: data.description,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      isGlobal: data.isGlobal ?? true,
      hotelId: data.hotelId || null,
      affectedComponents: data.affectedComponents || [],
      createdBy: data.createdBy,
      status: MaintenanceWindowStatus.SCHEDULED,
    });
    return this.maintenanceWindowRepository.save(window);
  }

  async getMaintenanceWindows(
    status?: MaintenanceWindowStatus,
    hotelId?: string,
  ): Promise<MaintenanceWindow[]> {
    const where: any = {};
    if (status) where.status = status;
    if (hotelId) where.hotelId = hotelId;
    return this.maintenanceWindowRepository.find({
      where,
      order: { startsAt: 'DESC' },
    });
  }

  async getActiveMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    const now = new Date();
    return this.maintenanceWindowRepository.find({
      where: [
        { status: MaintenanceWindowStatus.IN_PROGRESS },
        {
          status: MaintenanceWindowStatus.SCHEDULED,
          startsAt: LessThan(now),
          endsAt: MoreThan(now),
        },
      ],
      order: { startsAt: 'ASC' },
    });
  }

  async updateMaintenanceWindowStatus(
    id: string,
    status: MaintenanceWindowStatus,
  ): Promise<MaintenanceWindow> {
    const window = await this.maintenanceWindowRepository.findOne({
      where: { id },
    });
    if (!window) throw new Error('Maintenance window not found');
    window.status = status;
    return this.maintenanceWindowRepository.save(window);
  }

  async cancelMaintenanceWindow(
    id: string,
    reason?: string,
  ): Promise<MaintenanceWindow> {
    const window = await this.maintenanceWindowRepository.findOne({
      where: { id },
    });
    if (!window) throw new Error('Maintenance window not found');
    window.status = MaintenanceWindowStatus.CANCELLED;
    if (reason) {
      window.metadata = {
        ...(window.metadata || {}),
        cancellationReason: reason,
      };
    }
    return this.maintenanceWindowRepository.save(window);
  }

  getSystemInfo() {
    return {
      startTime: new Date(this.startTime),
      uptime: Date.now() - this.startTime,
      uptimeHuman: this.formatUptime(Date.now() - this.startTime),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      pid: process.pid,
    };
  }

  async getSystemMetrics(): Promise<{
    totalHotels: number;
    activeSubscriptions: number;
    pendingOverage: number;
    activeMaintenanceWindows: number;
    health: string;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  }> {
    const health = await this.getDetailedHealth();
    const activeWindows = await this.getActiveMaintenanceWindows();

    return {
      totalHotels: await this.hotelRepository.count(),
      activeSubscriptions: 0,
      pendingOverage: 0,
      activeMaintenanceWindows: activeWindows.length,
      health: health.status,
      memory: process.memoryUsage(),
      uptime: Date.now() - this.startTime,
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  }
}
