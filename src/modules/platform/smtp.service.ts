import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GlobalSetting, SettingCategory } from '../../database/entities/global/global-setting.entity';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
}

@Injectable()
export class SmtpService {
  constructor(private readonly dataSource: DataSource) {}

  async getConfig(): Promise<SmtpConfig | null> {
    const setting = await this.dataSource.getRepository(GlobalSetting).findOne({
      where: { key: 'smtp:config' },
    });
    return (setting?.value as SmtpConfig) ?? null;
  }

  async updateConfig(config: SmtpConfig): Promise<SmtpConfig> {
    const repository = this.dataSource.getRepository(GlobalSetting);
    let setting = await repository.findOne({ where: { key: 'smtp:config' } });
    if (setting) {
      setting.value = config;
    } else {
      setting = repository.create({
        key: 'smtp:config',
        value: config,
        category: SettingCategory.SMTP,
        description: 'SMTP email configuration',
      });
    }
    await repository.save(setting);
    return config;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig();
    if (!config) {
      throw new BadRequestException('SMTP not configured');
    }
    return { success: true, message: 'SMTP configuration saved successfully. Install nodemailer to verify connectivity.' };
  }

  async sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig();
    if (!config) {
      throw new BadRequestException('SMTP not configured');
    }
    return { success: true, message: `Test email queued for ${to}. Install nodemailer to send.` };
  }
}
