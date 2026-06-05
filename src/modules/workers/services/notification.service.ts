import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../../database/entities/notification.entity';
import { EmailService } from './email.service';

export interface SendNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  channel?: NotificationChannel;
  email?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly emailService: EmailService,
  ) {}

  async send(options: SendNotificationOptions): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: options.userId,
      type: options.type,
      title: options.title,
      body: options.body,
      data: options.data || null,
      channel: options.channel || NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    });

    const saved = await this.notificationRepository.save(notification);

    if (
      options.channel === NotificationChannel.EMAIL ||
      options.channel === NotificationChannel.BOTH
    ) {
      this.dispatchEmail(options);
    }

    this.logger.log(
      `Notification sent: ${options.type} -> user ${options.userId}`,
    );
    return saved;
  }

  async sendBulk(
    optionsList: SendNotificationOptions[],
  ): Promise<Notification[]> {
    const results: Notification[] = [];
    for (const opts of optionsList) {
      const n = await this.send(opts);
      results.push(n);
    }
    return results;
  }

  async markRead(id: string): Promise<void> {
    await this.notificationRepository.update(id, {
      readAt: new Date(),
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, readAt: null } as any, {
      readAt: new Date(),
    });
  }

  async findByUser(userId: string, limit = 50): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, readAt: null } as any,
    });
  }

  async hasUnreadByType(
    userId: string,
    type: NotificationType,
    hotelId?: string,
  ): Promise<boolean> {
    if (hotelId) {
      const count = await this.notificationRepository.count({
        where: {
          userId,
          type,
          readAt: null,
          data: Raw(alias => `${alias} @> '{"hotelId": "${hotelId}"}'`),
        } as any,
      });
      return count > 0;
    }
    const count = await this.notificationRepository.count({
      where: { userId, type, readAt: null } as any,
    });
    return count > 0;
  }

  private async dispatchEmail(options: SendNotificationOptions): Promise<void> {
    const recipient = options.email;
    if (!recipient) {
      this.logger.warn(`No email address for user ${options.userId}, skipping email`);
      return;
    }

    try {
      const sent = await this.emailService.send({
        to: recipient,
        subject: options.title,
        html: options.body,
      });
      if (sent) {
        this.logger.log(`[EMAIL] Sent to ${recipient} | Subject: ${options.title}`);
      } else {
        this.logger.warn(`[EMAIL] Failed to send to ${recipient}`);
      }
    } catch (err: any) {
      this.logger.error(`[EMAIL] Error sending to ${recipient}: ${err.message}`);
    }
  }
}
