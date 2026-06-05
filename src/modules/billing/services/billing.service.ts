import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Hotel, HotelStatus } from '../../../database/entities/hotel.entity';
import {
  SubscriptionPayment,
  SubscriptionPaymentMethod,
  SubscriptionPaymentStatus,
} from '../../../database/entities/global/subscription-payment.entity';
import {
  NotificationType,
  NotificationChannel,
} from '../../../database/entities/notification.entity';
import { ChapaService } from '../../public-booking/chapa.service';
import { NotificationService } from '../../workers/services/notification.service';
import { User } from '../../../database/entities/user.entity';
import { HotelUserAccess } from '../../../database/entities/hotel-user-access.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly backofficeUrl: string;
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(Hotel)
    private readonly hotelRepository: Repository<Hotel>,
    @InjectRepository(SubscriptionPayment)
    private readonly paymentRepository: Repository<SubscriptionPayment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(HotelUserAccess)
    private readonly accessRepository: Repository<HotelUserAccess>,
    private readonly chapaService: ChapaService,
    private readonly notificationService: NotificationService,
    config: ConfigService,
  ) {
    this.backofficeUrl =
      config.get<string>('BACKOFFICE_URL') || 'http://localhost:5000';
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') || 'http://abdures.localhost:3000';
  }

  // ── Hotel Owner: Check payment status for current month ──

  async getPaymentStatus(hotelId: string) {
    const hotel = await this.findHotelOrFail(hotelId);
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const currentPayment = await this.paymentRepository.findOne({
      where: {
        hotelId,
        periodStart: MoreThanOrEqual(startOfMonth),
        status: SubscriptionPaymentStatus.COMPLETED,
      },
    });

    const isPaid = !!currentPayment;
    const isOverdue = !isPaid && hotel.lastPaidAt != null && hotel.lastPaidAt < startOfMonth;
    const isSuspended = hotel.status === HotelStatus.SUSPENDED;

    return {
      hotelId,
      hotelName: hotel.name,
      status: hotel.status,
      monthlyRate: hotel.monthlyRate,
      lastPaidAt: hotel.lastPaidAt,
      billingPeriodStart: hotel.billingPeriodStart,
      currentMonthPaid: isPaid,
      isOverdue,
      isSuspended,
      dueAmount: isPaid ? 0 : hotel.monthlyRate || 0,
      periodStart: startOfMonth,
      periodEnd: endOfMonth,
    };
  }

  // ── Hotel Owner: View payment history ──

  async getPaymentHistory(hotelId: string) {
    await this.findHotelOrFail(hotelId);
    return this.paymentRepository.find({
      where: { hotelId },
      order: { periodStart: 'DESC' },
      take: 24,
    });
  }

  // ── Hotel Owner: Initiate Chapa payment for monthly subscription ──

  async initiateChapaPayment(hotelId: string, returnUrl?: string) {
    const hotel = await this.findHotelOrFail(hotelId);

    if (!hotel.monthlyRate || hotel.monthlyRate <= 0) {
      throw new BadRequestException('Monthly rate is not set for this hotel');
    }

    if (!hotel.ownerEmail) {
      throw new BadRequestException('Hotel owner email is not configured');
    }

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const payment = this.paymentRepository.create({
      hotelId,
      amount: hotel.monthlyRate,
      currency: hotel.currency || 'ETB',
      method: SubscriptionPaymentMethod.CHAPA,
      status: SubscriptionPaymentStatus.PENDING,
      periodStart: startOfMonth,
      periodEnd: endOfMonth,
    });
    const saved = await this.paymentRepository.save(payment);
    const txRef = `SUB${Date.now()}${Math.random().toString(36).substring(2, 8)}`;

    const ownerName = hotel.ownerName || hotel.ownerEmail.split('@')[0] || 'Hotel Owner';
    const [firstName, ...lastParts] = ownerName.split(' ');
    const lastName = lastParts.join(' ') || firstName;

    const callbackUrl = `${this.backofficeUrl}/api/v1/webhooks/chapa/subscription`;
    const finalReturnUrl = returnUrl || `${this.frontendUrl}/hotel/owner/billing`;

    try {
      const result = await this.chapaService.initiate({
        amount: hotel.monthlyRate,
        currency: hotel.currency || 'ETB',
        email: hotel.ownerEmail,
        firstName,
        lastName,
        txRef,
        returnUrl: `${finalReturnUrl}?tx_ref=${txRef}&hotel_id=${hotelId}`,
        callbackUrl,
        title: `Sub ${hotel.name}`.substring(0, 20),
        description: `${hotel.name} ${startOfMonth.toISOString().slice(0, 7)}`.substring(0, 40),
        meta: {
          paymentId: saved.id,
          hotelId,
          type: 'subscription',
        },
      });

      saved.transactionId = txRef;
      saved.gatewayResponse = { ...result, initiatedAt: new Date() };
      await this.paymentRepository.save(saved);

      return {
        checkoutUrl: result.checkoutUrl,
        txRef,
        paymentId: saved.id,
      };
    } catch (err: any) {
      saved.status = SubscriptionPaymentStatus.FAILED;
      saved.notes = `Chapa init failed: ${err.message}`;
      await this.paymentRepository.save(saved);
      throw new BadRequestException(`Payment initiation failed: ${err.message}`);
    }
  }

  // ── Hotel Owner: Upload bank transfer receipt (manual method) ──

  async uploadReceipt(hotelId: string, receiptUrl: string) {
    const hotel = await this.findHotelOrFail(hotelId);

    if (!hotel.monthlyRate || hotel.monthlyRate <= 0) {
      throw new BadRequestException('Monthly rate is not set for this hotel');
    }

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const payment = this.paymentRepository.create({
      hotelId,
      amount: hotel.monthlyRate,
      currency: hotel.currency || 'ETB',
      method: SubscriptionPaymentMethod.BANK_TRANSFER,
      status: SubscriptionPaymentStatus.PENDING,
      periodStart: startOfMonth,
      periodEnd: endOfMonth,
      receiptUrl,
    });
    await this.paymentRepository.save(payment);

    return { success: true, message: 'Receipt uploaded. Awaiting admin confirmation.' };
  }

  // ── Webhook: Verify payment confirmation from Chapa ──

  async handleChapaWebhook(
    payload: any,
    signature: string,
  ): Promise<{ received: boolean; action?: string }> {
    const isValid = this.chapaService.verifyWebhookSignature(
      JSON.stringify(payload),
      signature,
    );

    if (!isValid) {
      this.logger.warn('Invalid Chapa webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const txRef: string = payload?.tx_ref;
    if (!txRef || !txRef.startsWith('sub_')) {
      this.logger.log(`Ignoring non-subscription webhook: ${txRef}`);
      return { received: true };
    }

    const payment = await this.paymentRepository.findOne({
      where: { transactionId: txRef },
    });

    if (!payment) {
      this.logger.warn(`No subscription payment found for tx_ref: ${txRef}`);
      return { received: true };
    }

    if (payment.status === SubscriptionPaymentStatus.COMPLETED) {
      return { received: true, action: 'already_completed' };
    }

    const verification = await this.chapaService.verify(txRef);
    const chapaSuccess = verification.status === 'success';

    if (chapaSuccess) {
      payment.status = SubscriptionPaymentStatus.COMPLETED;
      payment.paidAt = new Date();
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        verifiedAt: new Date(),
        chapaStatus: verification.status,
        chapaAmount: verification.amount,
      };
      await this.paymentRepository.save(payment);

      const hotel = await this.hotelRepository.findOne({
        where: { id: payment.hotelId },
      });
      if (hotel) {
        hotel.lastPaidAt = new Date();
        hotel.billingPeriodStart = payment.periodStart;
        if (hotel.status === HotelStatus.SUSPENDED) {
          hotel.status = HotelStatus.ACTIVE;
        }
        await this.hotelRepository.save(hotel);

        await this.sendPaymentNotification(hotel, payment);
      }

      this.logger.log(`Subscription payment completed: ${txRef}`);
      return { received: true, action: 'completed' };
    }

    payment.status = SubscriptionPaymentStatus.FAILED;
    payment.gatewayResponse = {
      ...payment.gatewayResponse,
      verifiedAt: new Date(),
      chapaStatus: verification.status,
    };
    await this.paymentRepository.save(payment);

    this.logger.warn(`Subscription payment failed verification: ${txRef}`);
    return { received: true, action: 'failed' };
  }

  // ── Super Admin: Confirm manual payment ──

  async confirmPayment(paymentId: string, adminId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === SubscriptionPaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment is already completed');
    }

    payment.status = SubscriptionPaymentStatus.COMPLETED;
    payment.paidAt = new Date();
    payment.confirmedByAdminId = adminId;
    await this.paymentRepository.save(payment);

    const hotel = await this.hotelRepository.findOne({
      where: { id: payment.hotelId },
    });
    if (hotel) {
      hotel.lastPaidAt = new Date();
      hotel.billingPeriodStart = payment.periodStart;
      if (hotel.status === HotelStatus.SUSPENDED) {
        hotel.status = HotelStatus.ACTIVE;
      }
      await this.hotelRepository.save(hotel);

      await this.sendPaymentNotification(hotel, payment, true);
    }

    return { success: true, message: 'Payment confirmed successfully' };
  }

  // ── Super Admin: Override suspension ──

  async overrideSuspension(hotelId: string, adminId: string, reason?: string) {
    const hotel = await this.findHotelOrFail(hotelId);

    if (hotel.status !== HotelStatus.SUSPENDED) {
      throw new BadRequestException('Hotel is not currently suspended');
    }

    hotel.status = HotelStatus.ACTIVE;
    await this.hotelRepository.save(hotel);

    this.logger.log(
      `Suspension overridden for hotel "${hotel.name}" by admin ${adminId}${reason ? `: ${reason}` : ''}`,
    );

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    await this.paymentRepository.save({
      hotelId,
      amount: 0,
      currency: hotel.currency || 'ETB',
      method: SubscriptionPaymentMethod.MANUAL,
      status: SubscriptionPaymentStatus.COMPLETED,
      periodStart: startOfMonth,
      periodEnd: endOfMonth,
      paidAt: new Date(),
      confirmedByAdminId: adminId,
      notes: `Suspension override: ${reason || 'Admin override'}`,
    } as any);

    return { success: true, message: 'Suspension overridden successfully' };
  }

  // ── Super Admin: Set monthly rate for a hotel ──

  async setMonthlyRate(hotelId: string, rate: number) {
    if (rate < 0) {
      throw new BadRequestException('Monthly rate cannot be negative');
    }

    const hotel = await this.findHotelOrFail(hotelId);
    hotel.monthlyRate = rate;
    await this.hotelRepository.save(hotel);

    return { success: true, monthlyRate: rate };
  }

  // ── Super Admin: Get billing status for all hotels ──

  async getAllBillingStatus() {
    const hotels = await this.hotelRepository.find({
      order: { name: 'ASC' },
    });

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const results = await Promise.all(
      hotels.map(async (hotel) => {
        const currentPayment = await this.paymentRepository.findOne({
          where: {
            hotelId: hotel.id,
            periodStart: MoreThanOrEqual(startOfMonth),
            status: SubscriptionPaymentStatus.COMPLETED,
          },
        });

        const isPaid = !!currentPayment;
        const isDue =
          !isPaid &&
          hotel.monthlyRate != null &&
          hotel.monthlyRate > 0 &&
          (hotel.lastPaidAt == null || hotel.lastPaidAt < startOfMonth);

        return {
          hotelId: hotel.id,
          hotelName: hotel.name,
          ownerName: hotel.ownerName,
          ownerEmail: hotel.ownerEmail,
          status: hotel.status,
          monthlyRate: hotel.monthlyRate,
          lastPaidAt: hotel.lastPaidAt,
          currentMonthPaid: isPaid,
          isDue,
          paymentMethod: currentPayment?.method || null,
        };
      }),
    );

    return results;
  }

  // ── Super Admin: Aggregated billing summary for dashboard ──

  async getBillingSummary() {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const hotels = await this.hotelRepository.find({ where: { deletedAt: null } as any });

    const completedThisMonth = await this.paymentRepository.find({
      where: {
        status: SubscriptionPaymentStatus.COMPLETED,
        paidAt: MoreThanOrEqual(startOfMonth),
      },
    });

    const pendingPayments = await this.paymentRepository.find({
      where: { status: SubscriptionPaymentStatus.PENDING },
    });

    const hotelsWithRate = hotels.filter(h => h.monthlyRate && h.monthlyRate > 0);
    const paidHotelIds = new Set(completedThisMonth.map(p => p.hotelId));

    const collectedThisMonth = completedThisMonth.reduce((s, p) => s + Number(p.amount), 0);
    const pendingAmount = pendingPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalMonthlyRevenue = hotelsWithRate.reduce((s, h) => s + Number(h.monthlyRate), 0);

    const overdueCount = hotelsWithRate.filter(h =>
      !paidHotelIds.has(h.id) && h.lastPaidAt != null && h.lastPaidAt < startOfMonth
    ).length;

    const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
    const monthlyData = await this.paymentRepository
      .createQueryBuilder('p')
      .select("to_char(p.paidAt, 'YYYY-MM')", 'month')
      .addSelect('SUM(p.amount)', 'amount')
      .where('p.status = :status', { status: SubscriptionPaymentStatus.COMPLETED })
      .andWhere('p.paidAt >= :start', { start: twelveMonthsAgo })
      .groupBy("to_char(p.paidAt, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany();

    return {
      totalHotels: hotels.length,
      hotelsWithRate: hotelsWithRate.length,
      paidThisMonth: paidHotelIds.size,
      overdueCount,
      collectedThisMonth,
      pendingAmount,
      totalMonthlyRevenue,
      monthlyCollectionHistory: monthlyData.map(d => ({
        month: d.month,
        amount: Number(d.amount),
      })),
    };
  }

  // ── Super Admin: List pending payments for a hotel ──

  async getPendingPayments(hotelId: string) {
    await this.findHotelOrFail(hotelId);
    return this.paymentRepository.find({
      where: {
        hotelId,
        status: SubscriptionPaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Helpers ──

  async findHotelOrFail(hotelId: string): Promise<Hotel> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel) {
      throw new NotFoundException(`Hotel not found: ${hotelId}`);
    }
    return hotel;
  }

  private async sendPaymentNotification(
    hotel: Hotel,
    payment: SubscriptionPayment,
    isManual = false,
  ) {
    const ownerUsers = await this.accessRepository.find({
      where: { hotelId: hotel.id, status: 'ACTIVE' as any },
    });

    const notifiedIds = new Set<string>();

    for (const access of ownerUsers) {
      if (notifiedIds.has(access.userId)) continue;
      notifiedIds.add(access.userId);

      const user = await this.userRepository.findOne({
        where: { id: access.userId },
      });

      await this.notificationService.send({
        userId: access.userId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment Confirmed',
        body: isManual
          ? `Your monthly subscription payment of ${payment.amount} ${payment.currency} for ${hotel.name} has been confirmed by admin.`
          : `Your monthly subscription payment of ${payment.amount} ${payment.currency} for ${hotel.name} has been received successfully.`,
        data: { hotelId: hotel.id, paymentId: payment.id, amount: payment.amount },
        channel: user?.email ? NotificationChannel.BOTH : NotificationChannel.IN_APP,
        email: user?.email || hotel.ownerEmail,
      });
    }

    if (notifiedIds.size === 0 && hotel.ownerEmail) {
      await this.notificationService.send({
        userId: hotel.id,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment Confirmed',
        body: `Monthly subscription payment of ${payment.amount} ${payment.currency} for ${hotel.name} has been confirmed.`,
        data: { hotelId: hotel.id, paymentId: payment.id, amount: payment.amount },
        channel: NotificationChannel.EMAIL,
        email: hotel.ownerEmail,
      });
    }
  }
}
