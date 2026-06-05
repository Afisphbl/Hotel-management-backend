import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  GlobalSetting,
  SettingCategory,
} from '../../../database/entities/global/global-setting.entity';
import * as nodemailer from 'nodemailer';

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

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromName = '';
  private fromEmail = '';

  constructor(private readonly dataSource: DataSource) {}

  private async getTransporter(): Promise<{
    transporter: nodemailer.Transporter;
    fromName: string;
    fromEmail: string;
  }> {
    if (this.transporter) {
      return { transporter: this.transporter, fromName: this.fromName, fromEmail: this.fromEmail };
    }

    const setting = await this.dataSource
      .getRepository(GlobalSetting)
      .findOne({ where: { key: 'smtp:config' } });

    if (!setting?.value) {
      throw new Error('SMTP not configured. Set SMTP config in platform settings first.');
    }

    const config = setting.value as SmtpConfig;

    this.fromName = config.fromName || 'Hotel Booking Platform';
    this.fromEmail = config.fromEmail || config.username;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    return { transporter: this.transporter, fromName: this.fromName, fromEmail: this.fromEmail };
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      const { transporter, fromName, fromEmail } = await this.getTransporter();

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`);
      return false;
    }
  }

  clearTransporter(): void {
    this.transporter = null;
  }
}
