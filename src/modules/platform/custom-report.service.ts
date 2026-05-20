import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CustomReport,
  ReportType,
  ReportFormat,
  ReportSchedule,
} from '../../database/entities/global/custom-report.entity';
import {
  AnalyticsSnapshot,
  SnapshotType,
} from '../../database/entities/analytics-snapshot.entity';

@Injectable()
export class CustomReportService {
  constructor(
    @InjectRepository(CustomReport)
    private reportRepository: Repository<CustomReport>,
    @InjectRepository(AnalyticsSnapshot)
    private snapshotRepository: Repository<AnalyticsSnapshot>,
  ) {}

  async findAll(hotelId?: string): Promise<CustomReport[]> {
    const where: any = {};
    if (hotelId) where.hotelId = hotelId;
    return this.reportRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<CustomReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async create(data: Partial<CustomReport>): Promise<CustomReport> {
    const report = this.reportRepository.create(data);
    return this.reportRepository.save(report);
  }

  async update(id: string, data: Partial<CustomReport>): Promise<CustomReport> {
    const report = await this.findById(id);
    Object.assign(report, data);
    return this.reportRepository.save(report);
  }

  async delete(id: string): Promise<void> {
    const report = await this.findById(id);
    await this.reportRepository.remove(report);
  }

  async runReport(report: CustomReport): Promise<any> {
    const config = report.config;
    const snapshotType = this.resolveSnapshotType(report.reportType);
    const snapshot = await this.snapshotRepository.findOne({
      where: { snapshotType, hotelId: report.hotelId || undefined as any },
      order: { periodStart: 'DESC' },
    });

    if (!snapshot) return { data: [], message: 'No data available for this report' };
    return this.processReportData(snapshot.data, config);
  }

  private resolveSnapshotType(reportType: ReportType): SnapshotType {
    const map: Record<ReportType, SnapshotType> = {
      [ReportType.REVENUE]: SnapshotType.REVENUE_SUMMARY,
      [ReportType.OCCUPANCY]: SnapshotType.DAILY_OCCUPANCY,
      [ReportType.BOOKINGS]: SnapshotType.BOOKING_STATS,
      [ReportType.FINANCIAL]: SnapshotType.FINANCIAL_REPORT,
      [ReportType.TAX]: SnapshotType.REVENUE_SUMMARY,
      [ReportType.CUSTOM]: SnapshotType.PLATFORM_KPI,
    };
    return map[reportType];
  }

  private processReportData(data: any, config: CustomReport['config']): any {
    let result = data;

    if (config.filters && typeof data === 'object') {
      const dataArray = Array.isArray(data) ? data : [data];
      result = dataArray.filter((item: any) => {
        return Object.entries(config.filters).every(([key, value]) => {
          return item[key] === value;
        });
      });
    }

    const sortBy = config.sortBy;
    const sortOrder = config.sortOrder;
    if (sortBy && Array.isArray(result)) {
      const order = sortOrder === 'desc' ? -1 : 1;
      result = [...result].sort((a: any, b: any) => {
        if (a[sortBy] < b[sortBy]) return -1 * order;
        if (a[sortBy] > b[sortBy]) return 1 * order;
        return 0;
      });
    }

    if (config.limit && Array.isArray(result)) {
      result = result.slice(0, config.limit);
    }

    if (config.metrics?.length && Array.isArray(result)) {
      result = result.map((item: any) => {
        const filtered: any = {};
        for (const key of config.metrics) {
          if (key in item) filtered[key] = item[key];
        }
        return filtered;
      });
    }

    return result;
  }
}
