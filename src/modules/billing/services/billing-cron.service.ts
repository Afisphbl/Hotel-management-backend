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

  private async getOwnerEmail(hotel: Hotel): Promise<string | null> {
    if (hotel.ownerEmail) return hotel.ownerEmail;

    const access = await this.accessRepository.findOne({
      where: { hotelId: hotel.id, status: 'ACTIVE' as any },
    });
    if (!access) return null;

    const user = await this.userRepository.findOne({
      where: { id: access.userId },
    });
    return user?.email || null;
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
      const ownerEmail = await this.getOwnerEmail(hotel);
      const ownerName = hotel.ownerName || 'Hotel Owner';

      const html = paymentReminderTemplate({
        ownerName,
        hotelName: hotel.name,
        amount: hotel.monthlyRate || 0,
        currency: hotel.currency || 'ETB',
        dueDate: new Date().toISOString().slice(0, 10),
        reminderNumber,
        payUrl: `${this.getFrontendUrl()}/owner/billing`,
      });

      await this.notificationService.send({
        userId: hotel.id,
        type: NotificationType.PAYMENT_REMINDER,
        title: reminderNumber === 1
          ? 'Payment Reminder: Monthly subscription due'
          : 'Urgent: Second payment reminder — account at risk',
        body: html,
        data: {
          hotelId: hotel.id,
          amount: hotel.monthlyRate,
          reminderNumber,
        },
        channel: ownerEmail ? NotificationChannel.EMAIL : NotificationChannel.IN_APP,
        email: ownerEmail || undefined,
      });

      this.logger.log(
        `[REMINDER ${reminderNumber}] Sent to hotel "${hotel.name}" (${hotel.id}) — ${ownerEmail || 'no email'}`,
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
      const ownerEmail = await this.getOwnerEmail(hotel);
      const ownerName = hotel.ownerName || 'Hotel Owner';

      hotel.status = HotelStatus.SUSPENDED;
      await this.hotelRepository.save(hotel);

      const html = accountSuspendedTemplate({
        ownerName,
        hotelName: hotel.name,
        amount: hotel.monthlyRate || 0,
        currency: hotel.currency || 'ETB',
        payUrl: `${this.getFrontendUrl()}/owner/billing`,
      });

      await this.notificationService.send({
        userId: hotel.id,
        type: NotificationType.ACCOUNT_SUSPENDED,
        title: 'Account Suspended — Payment Required',
        body: html,
        data: {
          hotelId: hotel.id,
          amount: hotel.monthlyRate,
        },
        channel: ownerEmail ? NotificationChannel.EMAIL : NotificationChannel.IN_APP,
        email: ownerEmail || undefined,
      });

      this.logger.log(
        `[SUSPENDED] Hotel "${hotel.name}" (${hotel.id}) — ${ownerEmail || 'no email'}`,
      );
    }
  }

  private getFrontendUrl(): string {
    return process.env.BACKOFFICE_URL?.replace('/api/v1', '') || 'http://localhost:3000';
  }
}
