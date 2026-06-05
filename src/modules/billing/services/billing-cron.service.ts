import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hotel, HotelStatus } from '../../../database/entities/hotel.entity';
import {
  NotificationChannel,
  NotificationType,
} from '../../../database/entities/notification.entity';
import { NotificationService } from '../../workers/services/notification.service';
import { EmailService } from '../../workers/services/email.service';
import {
  paymentReminderTemplate,
  accountSuspendedTemplate,
} from '../../workers/services/email-templates';
import { User } from '../../../database/entities/user.entity';
import { HotelUserAccess } from '../../../database/entities/hotel-user-access.entity';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    @InjectRepository(Hotel)
    private readonly hotelRepository: Repository<Hotel>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(HotelUserAccess)
    private readonly accessRepository: Repository<HotelUserAccess>,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {}

  @Cron('0 0 1-3 * *', {
    name: 'monthly-billing-check',
    timeZone: 'Africa/Addis_Ababa',
  })
  async handleMonthlyBilling(): Promise<void> {
    const dayOfMonth = this.getDayInTimezone('Africa/Addis_Ababa');

    this.logger.log(`Monthly billing check: Addis day ${dayOfMonth}`);

    if (dayOfMonth === 1) {
      await this.sendPaymentReminders(1);
    } else if (dayOfMonth === 2) {
      await this.sendPaymentReminders(2);
    } else if (dayOfMonth === 3) {
      await this.suspendOverdueHotels();
    }
  }

  private getDayInTimezone(tz: string): number {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      day: 'numeric',
    });
    return parseInt(formatter.format(now), 10);
  }

  private async findHotelsDueForPayment(): Promise<Hotel[]> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    return this.hotelRepository
      .createQueryBuilder('hotel')
      .where('hotel.status != :suspended', { suspended: HotelStatus.SUSPENDED })
      .andWhere('hotel.monthlyRate IS NOT NULL')
      .andWhere('hotel.monthlyRate > 0')
      .andWhere(
        `(hotel.lastPaidAt IS NULL OR hotel.lastPaidAt < :startOfMonth)`,
        { startOfMonth },
      )
      .getMany();
  }

  private async getOwnerUsers(hotel: Hotel): Promise<Array<{ userId: string; email: string | null }>> {
    const result: Array<{ userId: string; email: string | null }> = [];

    const accessList = await this.accessRepository.find({
      where: { hotelId: hotel.id, status: 'ACTIVE' as any },
    });

    const seen = new Set<string>();
    for (const access of accessList) {
      if (seen.has(access.userId)) continue;
      seen.add(access.userId);

      const user = await this.userRepository.findOne({
        where: { id: access.userId },
      });
      result.push({
        userId: access.userId,
        email: user?.email || null,
      });
    }

    if (result.length === 0 && hotel.ownerEmail) {
      const user = await this.userRepository.findOne({
        where: { email: hotel.ownerEmail },
      });
      if (user) {
        result.push({ userId: user.id, email: user.email });
      }
    }

    return result;
  }

  private async sendPaymentReminders(reminderNumber: number): Promise<void> {
    const dueHotels = await this.findHotelsDueForPayment();

    if (dueHotels.length === 0) {
      this.logger.log(`Day ${reminderNumber}: no hotels due for payment`);
      return;
    }

    this.logger.log(
      `Day ${reminderNumber}: found ${dueHotels.length} hotel(s) needing payment reminder`,
    );

    for (const hotel of dueHotels) {
      const ownerUsers = await this.getOwnerUsers(hotel);
      const ownerName = hotel.ownerName || 'Hotel Owner';
      const amount = hotel.monthlyRate || 0;
      const currency = hotel.currency || 'ETB';

      const body = `Your monthly subscription of ${amount} ${currency} for ${hotel.name} is due. Please complete your payment to keep your account active.`;

      for (const owner of ownerUsers) {
        await this.notificationService.send({
          userId: owner.userId,
          type: NotificationType.PAYMENT_REMINDER,
          title: reminderNumber === 1
            ? 'Monthly Payment Due'
            : 'Urgent: Payment Overdue — Account at Risk',
          body,
          data: {
            hotelId: hotel.id,
            amount,
            reminderNumber,
          },
          channel: owner.email ? NotificationChannel.BOTH : NotificationChannel.IN_APP,
          email: owner.email || undefined,
        });
      }

      if (ownerUsers.length === 0) {
        const html = paymentReminderTemplate({
          ownerName,
          hotelName: hotel.name,
          amount,
          currency,
          dueDate: new Date().toISOString().slice(0, 10),
          reminderNumber,
          payUrl: `${this.getFrontendUrl()}/owner/billing`,
        });

        await this.notificationService.send({
          userId: hotel.id,
          type: NotificationType.PAYMENT_REMINDER,
          title: reminderNumber === 1
            ? 'Monthly Payment Due'
            : 'Urgent: Payment Overdue — Account at Risk',
          body: html,
          data: { hotelId: hotel.id, amount, reminderNumber },
          channel: hotel.ownerEmail ? NotificationChannel.EMAIL : NotificationChannel.IN_APP,
          email: hotel.ownerEmail || undefined,
        });
      }

      this.logger.log(
        `[REMINDER ${reminderNumber}] Sent to ${ownerUsers.length} user(s) for hotel "${hotel.name}"`,
      );
    }
  }

  private async suspendOverdueHotels(): Promise<void> {
    const dueHotels = await this.findHotelsDueForPayment();

    if (dueHotels.length === 0) {
      this.logger.log('Day 3: no hotels to suspend');
      return;
    }

    this.logger.log(
      `Day 3: suspending ${dueHotels.length} hotel(s) with overdue payment`,
    );

    for (const hotel of dueHotels) {
      hotel.status = HotelStatus.SUSPENDED;
      await this.hotelRepository.save(hotel);

      const ownerUsers = await this.getOwnerUsers(hotel);
      const amount = hotel.monthlyRate || 0;
      const currency = hotel.currency || 'ETB';

      const body = `Your account for ${hotel.name} has been suspended due to non-payment of ${amount} ${currency}. Please pay to reactivate.`;

      for (const owner of ownerUsers) {
        await this.notificationService.send({
          userId: owner.userId,
          type: NotificationType.ACCOUNT_SUSPENDED,
          title: 'Account Suspended — Payment Required',
          body,
          data: { hotelId: hotel.id, amount },
          channel: owner.email ? NotificationChannel.BOTH : NotificationChannel.IN_APP,
          email: owner.email || undefined,
        });
      }

      if (ownerUsers.length === 0) {
        const html = accountSuspendedTemplate({
          ownerName: hotel.ownerName || 'Hotel Owner',
          hotelName: hotel.name,
          amount,
          currency,
          payUrl: `${this.getFrontendUrl()}/owner/billing`,
        });

        await this.notificationService.send({
          userId: hotel.id,
          type: NotificationType.ACCOUNT_SUSPENDED,
          title: 'Account Suspended — Payment Required',
          body: html,
          data: { hotelId: hotel.id, amount },
          channel: hotel.ownerEmail ? NotificationChannel.EMAIL : NotificationChannel.IN_APP,
          email: hotel.ownerEmail || undefined,
        });
      }

      this.logger.log(
        `[SUSPENDED] Hotel "${hotel.name}" — ${ownerUsers.length} user(s) notified`,
      );
    }
  }

  private getFrontendUrl(): string {
    return process.env.BACKOFFICE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
  }
}
