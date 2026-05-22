import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { UserScope } from '../../database/entities/user.entity';
import { AnalyticsExportService } from './analytics-export.service';
import { CustomReportService } from './custom-report.service';
import { SnapshotType } from '../../database/entities/analytics-snapshot.entity';
import { ReportFormat } from '../../database/entities/global/custom-report.entity';
import type { Response } from 'express';

@Controller('platform/analytics')
@UseGuards(JwtAuthGuard, ScopeGuard)
@Scopes(UserScope.PLATFORM)
export class PlatformAnalyticsExportController {
  constructor(
    private readonly exportService: AnalyticsExportService,
    private readonly customReportService: CustomReportService,
  ) {}

  @Get('export/:snapshotType')
  async exportSnapshot(
    @Param('snapshotType') snapshotType: SnapshotType,
    @Query('format') format: ReportFormat = ReportFormat.JSON,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportSnapshot(
      snapshotType,
      format,
    );
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    if (typeof result.data === 'string') {
      return res.send(result.data);
    }
    return res.json(result.data);
  }

  @Get('reports')
  async getReports(@Query('hotelId') hotelId?: string) {
    return this.customReportService.findAll(hotelId);
  }

  @Get('reports/:id')
  async getReport(@Param('id') id: string) {
    return this.customReportService.findById(id);
  }

  @Post('reports')
  async createReport(@Body() data: any) {
    return this.customReportService.create(data);
  }

  @Post('reports/:id')
  async updateReport(@Param('id') id: string, @Body() data: any) {
    return this.customReportService.update(id, data);
  }

  @Post('reports/:id/run')
  async runReport(@Param('id') id: string) {
    const report = await this.customReportService.findById(id);
    return this.customReportService.runReport(report);
  }

  @Post('reports/:id/export')
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: ReportFormat = ReportFormat.JSON,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportCustomReport(id, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    if (typeof result.data === 'string') {
      return res.send(result.data);
    }
    return res.json(result.data);
  }

  @Post('reports/:id/delete')
  async deleteReport(@Param('id') id: string) {
    await this.customReportService.delete(id);
    return { success: true };
  }
}
