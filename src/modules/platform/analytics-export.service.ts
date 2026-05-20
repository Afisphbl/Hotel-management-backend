import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsSnapshot, SnapshotType } from '../../database/entities/analytics-snapshot.entity';
import { CustomReport, ReportFormat, ReportType } from '../../database/entities/global/custom-report.entity';
import { CustomReportService } from './custom-report.service';

@Injectable()
export class AnalyticsExportService {
  constructor(
    @InjectRepository(AnalyticsSnapshot)
    private snapshotRepository: Repository<AnalyticsSnapshot>,
    private customReportService: CustomReportService,
  ) {}

  async exportSnapshot(snapshotType: SnapshotType, format: ReportFormat): Promise<{ data: any; contentType: string; filename: string }> {
    const snapshot = await this.snapshotRepository.findOne({
      where: { snapshotType },
      order: { periodStart: 'DESC' },
    });
    if (!snapshot) throw new BadRequestException('No snapshot data found for the specified type');

    const rawData = snapshot.data;
    const filename = `${snapshotType}_${snapshot.periodStart.toISOString().split('T')[0]}`;

    return this.formatExport(rawData, format, filename);
  }

  async exportCustomReport(reportId: string, format: ReportFormat): Promise<{ data: any; contentType: string; filename: string }> {
    const report = await this.customReportService.findById(reportId);
    const result = await this.customReportService.runReport(report);
    const filename = `${report.name.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}`;
    return this.formatExport(result, format, filename);
  }

  private formatExport(data: any, format: ReportFormat, filename: string): { data: any; contentType: string; filename: string } {
    switch (format) {
      case ReportFormat.JSON:
        return {
          data,
          contentType: 'application/json',
          filename: `${filename}.json`,
        };
      case ReportFormat.CSV:
        return {
          data: this.toCsv(data),
          contentType: 'text/csv',
          filename: `${filename}.csv`,
        };
      default:
        return {
          data,
          contentType: 'application/json',
          filename: `${filename}.json`,
        };
    }
  }

  private toCsv(data: any): string {
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      const headers = Object.keys(data[0]);
      const rows = data.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(','),
      );
      return [headers.join(','), ...rows].join('\n');
    }
    if (typeof data === 'object' && data !== null) {
      return this.toCsv([data]);
    }
    return String(data);
  }
}
