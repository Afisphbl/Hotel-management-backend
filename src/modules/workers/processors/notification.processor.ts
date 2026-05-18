import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { NotificationChannel, NotificationType } from '../../../database/entities/notification.entity';

export interface NotificationJobData {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  channel?: NotificationChannel;
  email?: string;
}

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private notificationService: NotificationService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<any> {
    const { userId, type, title, body, data, channel, email } = job.data;

    this.logger.log(
      `Processing notification: ${type} -> user ${userId} via ${channel || 'in_app'}`,
    );

    try {
      const notification = await this.notificationService.send({
        userId,
        type,
        title,
        body,
        data,
        channel: channel || NotificationChannel.IN_APP,
        email,
      });

      return { notificationId: notification.id, status: notification.status };
    } catch (err) {
      this.logger.error(
        `Failed to send notification ${type} to user ${userId}: ${err.message}`,
      );
      throw err;
    }
  }
}
