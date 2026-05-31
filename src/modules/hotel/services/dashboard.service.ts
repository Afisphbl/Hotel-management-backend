import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, In } from 'typeorm';
import {
  Booking,
  BookingStatus,
} from '../../../database/entities/booking.entity';
import { BookingRoom } from '../../../database/entities/booking-room.entity';
import {
  RoomNight,
  RoomNightStatus,
} from '../../../database/entities/room-night.entity';
import { Room, RoomStatus } from '../../../database/entities/room.entity';
import { Guest } from '../../../database/entities/guest.entity';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import {
  Payment,
  PaymentStatus,
} from '../../../database/entities/payment.entity';
import { Staff, StaffStatus } from '../../../database/entities/staff.entity';
import { Hotel } from '../../../database/entities/hotel.entity';
import { Refund } from '../../../database/entities/refund.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(BookingRoom)
    private bookingRoomRepository: Repository<BookingRoom>,
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
    @InjectRepository(Refund)
    private refundRepository: Repository<Refund>,
    @InjectRepository(RoomNight)
    private roomNightRepository: Repository<RoomNight>,
  ) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Basic room metrics
    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      dirtyRooms,
      maintenanceRooms,
    ] = await Promise.all([
      this.roomRepository.count(),
      this.roomRepository.count({ where: { status: RoomStatus.AVAILABLE } }),
      this.roomRepository.count({ where: { status: RoomStatus.OCCUPIED } }),
      this.roomRepository.count({ where: { status: RoomStatus.DIRTY } }),
      this.roomRepository.count({ where: { status: RoomStatus.MAINTENANCE } }),
    ]);

    const hotels = await this.hotelRepository.find();
    const storedRoomTotal = hotels.reduce(
      (sum, hotel) => sum + (hotel.rooms || 0),
      0,
    );
    const resolvedTotalRooms = totalRooms > 0 ? totalRooms : storedRoomTotal;
    const resolvedAvailableRooms =
      totalRooms > 0 ? availableRooms : storedRoomTotal;

    // Booking metrics
    const [
      todayCheckIns,
      todayCheckOuts,
      activeBookings,
      monthlyBookings,
      yearlyBookings,
      confirmedBookings,
      checkedInBookings,
    ] = await Promise.all([
      this.bookingRepository.count({
        where: {
          status: BookingStatus.CONFIRMED,
          checkIn: Between(todayStart, todayEnd),
        },
      }),
      this.bookingRepository.count({
        where: {
          status: BookingStatus.CHECKED_IN,
          checkOut: Between(todayStart, todayEnd),
        },
      }),
      this.bookingRepository.count({
        where: {
          status: BookingStatus.CONFIRMED,
        },
      }),
      this.bookingRepository.count({
        where: {
          createdAt: Between(monthStart, monthEnd),
        },
      }),
      this.bookingRepository.count({
        where: {
          createdAt: Between(yearStart, now),
        },
      }),
      this.bookingRepository.count({
        where: { status: BookingStatus.CONFIRMED },
      }),
      this.bookingRepository.count({
        where: { status: BookingStatus.CHECKED_IN },
      }),
    ]);

    // Financial metrics
    const [
      todayRevenue,
      monthlyRevenue,
      yearlyRevenue,
      totalRevenue,
      pendingInvoices,
      overdueInvoices,
      recentPayments,
    ] = await Promise.all([
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice."updatedAt" BETWEEN :start AND :end', {
          start: todayStart,
          end: todayEnd,
        })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice."updatedAt" BETWEEN :start AND :end', {
          start: monthStart,
          end: monthEnd,
        })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice."updatedAt" BETWEEN :start AND :end', {
          start: yearStart,
          end: now,
        })
        .getRawOne(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .getRawOne(),
      this.invoiceRepository.count({
        where: { status: InvoiceStatus.ISSUED },
      }),
      this.invoiceRepository.count({
        where: { status: InvoiceStatus.OVERDUE },
      }),
      this.paymentRepository.find({
        where: { status: PaymentStatus.COMPLETED },
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['invoice'],
      }),
    ]);

    // Guest metrics
    const totalGuests = await this.guestRepository.count();

    // Staff metrics
    const [totalStaff, activeStaff, todayShifts] = await Promise.all([
      this.staffRepository.count(),
      this.staffRepository.count({ where: { status: StaffStatus.ACTIVE } }),
      this.staffRepository.count({
        where: {
          status: StaffStatus.ACTIVE,
        },
      }),
    ]);

    // Calculate occupancy rate
    const occupancyRate =
      resolvedTotalRooms > 0
        ? Math.round((occupiedRooms / resolvedTotalRooms) * 100)
        : 0;

    // Enhanced Profit Calculation using Ledger Entries
    const monthProfitResult = await this.ledgerRepository
      .createQueryBuilder('ledger')
      .select('SUM(ledger.credit) - SUM(ledger.debit)', 'profit')
      .addSelect('SUM(ledger.debit)', 'expenses')
      .addSelect('SUM(ledger.credit)', 'income')
      .where('ledger."entryDate" BETWEEN :start AND :end', {
        start: monthStart,
        end: monthEnd,
      })
      .getRawOne();
    
    const monthlyProfit = Number(monthProfitResult?.profit || 0);
    const monthlyExpenses = Number(monthProfitResult?.expenses || 0);

    // Generate trend data for charts
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [occupancyTrend, revenueTrend, bookingTrend, expenseTrend, expenseByAccount, recentExpenses, heatmap, bookingSource, revenue30d] = await Promise.all([
      this.generateOccupancyTrend(monthStart, now),
      this.generateRevenueTrend(monthStart, now),
      this.generateBookingTrend(monthStart, now),
      this.ledgerRepository
        .createQueryBuilder('ledger')
        .select(`TO_CHAR(ledger."entryDate", 'YYYY-MM-DD')`, 'date')
        .addSelect('SUM(ledger.debit)', 'expenses')
        .where('ledger."entryDate" BETWEEN :start AND :end', { start: monthStart, end: now })
        .andWhere('ledger.debit > 0')
        .groupBy('date')
        .orderBy('date', 'ASC')
        .getRawMany(),
      this.ledgerRepository
        .createQueryBuilder('ledger')
        .select('ledger.accountId', 'accountId')
        .addSelect('SUM(ledger.debit)', 'total')
        .where('ledger."entryDate" BETWEEN :start AND :end', { start: monthStart, end: now })
        .andWhere('ledger.debit > 0')
        .groupBy('ledger.accountId')
        .orderBy('SUM(ledger.debit)', 'DESC')
        .getRawMany(),
      this.ledgerRepository.find({
        where: { debit: MoreThan(0) },
        order: { entryDate: 'DESC' },
        take: 5,
      }),
      this.generateHeatmap(14),
      this.getBookingSourceDistribution(),
      this.generateRevenueTrend(thirtyDaysAgo, now),
    ]);

    // Recent bookings for activity feed
    const recentBookings = await this.bookingRepository.find({
      where: { status: BookingStatus.CONFIRMED },
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['guest', 'bookingRooms', 'bookingRooms.room'],
    });

    return {
      // Core metrics
      occupancy: occupancyRate,
      totalRooms: resolvedTotalRooms,
      availableRooms: resolvedAvailableRooms,
      occupiedRooms,
      dirtyRooms,
      maintenanceRooms,

      // Booking metrics
      todayCheckIns,
      todayCheckOuts,
      activeBookings,
      monthlyBookings,
      yearlyBookings,
      confirmedBookings,
      checkedInBookings,

      // Financial metrics
      todayRevenue: Number(todayRevenue?.revenue || 0),
      monthlyRevenue: Number(monthlyRevenue?.revenue || 0),
      yearlyRevenue: Number(yearlyRevenue?.revenue || 0),
      totalRevenue: Number(totalRevenue?.revenue || 0),
      monthlyProfit,
      monthlyExpenses,
      expenseTrend: expenseTrend.map(r => ({
        date: r.date,
        expenses: Number(r.expenses),
      })),
      expenseByAccount: expenseByAccount.map(r => ({
        accountId: r.accountId,
        total: Number(r.total),
      })),
      recentExpenses: await (async () => {
        const refundEntries = recentExpenses.filter(e => e.referenceType === 'REFUND');
        const refundIds = refundEntries.map(e => e.referenceId);
        const refundMap = new Map<string, Refund>();
        if (refundIds.length > 0) {
          const refunds = await this.refundRepository.find({
            where: { id: In(refundIds) },
            relations: ['payment', 'invoice', 'booking', 'booking.guest'],
          });
          for (const r of refunds) refundMap.set(r.id, r);
        }
        return recentExpenses.map(e => {
          let display = e.description;
          if (e.referenceType === 'REFUND') {
            const refund = refundMap.get(e.referenceId);
            if (refund) {
              const guestName = refund.booking?.guest
                ? `${refund.booking.guest.firstName} ${refund.booking.guest.lastName}`
                : null;
              const invoiceLabel = refund.invoice?.invoiceNumber
                ? `Invoice ${refund.invoice.invoiceNumber}`
                : null;
              const label = guestName || invoiceLabel || `payment ${refund.paymentId.slice(0, 8)}...`;
              display = `Refund (${refund.reason})${label ? ` - ${label}` : ''}`;
            }
          }
          return {
            id: e.id,
            accountId: e.accountId,
            amount: Number(e.debit),
            description: display,
            entryDate: e.entryDate,
          };
        });
      })(),
      pendingInvoices,
      overdueInvoices,

      // Guest metrics
      totalGuests,

      // Staff metrics
      totalStaff,
      activeStaff,
      todayShifts,

      // Recent activities
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        createdAt: payment.createdAt,
        invoice: payment.invoice
          ? {
              id: payment.invoice.id,
              amount: payment.invoice.amount,
              status: payment.invoice.status,
            }
          : null,
      })),
      recentBookings: recentBookings.map((booking) => ({
        id: booking.id,
        guestName: booking.guest
          ? `${booking.guest.firstName} ${booking.guest.lastName}`.trim()
          : 'N/A',
        roomNumber: booking.bookingRooms?.[0]?.room?.roomNumber || 'N/A',
        nights: this.calculateNights(booking.checkIn, booking.checkOut),
        status: booking.status,
        createdAt: booking.createdAt,
        totalPrice: booking.totalPrice,
      })),

      // Chart data
      occupancyTrend,
      revenueTrend,
      bookingTrend,
      heatmap,
      bookingSource,
      revenue30d,
    };
  }

  async getReports(hotelId: string, days?: number) {
    const now = new Date();
    const effectiveDays = days ?? 180;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - effectiveDays);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalRooms = await this.roomRepository.count();
    const occupiedRooms = await this.roomRepository.count({
      where: { status: RoomStatus.OCCUPIED },
    });
    const occupancyRate =
      totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    const hotelRooms = await this.roomRepository.find({ select: ['id'] });
    const roomIds = hotelRooms.map(r => r.id);
    let bookingIds: string[] = [];
    if (roomIds.length > 0) {
      const bookingRooms = await this.bookingRoomRepository.find({
        where: { roomId: In(roomIds) },
        select: ['bookingId'],
      });
      bookingIds = [...new Set(bookingRooms.map(br => br.bookingId))];
    }

    if (bookingIds.length === 0) {
      return {
        revenueByMonth: [],
        revenueTrend: [],
        occupancyTrend: [],
        bookingSource: [],
        bookingDistribution: [],
        guestStatistics: { totalGuests: 0, newGuests: 0, returningGuests: 0, averageStay: 0 },
        financialMetrics: { totalRevenue: 0, averageDailyRate: 0, revenuePAR: 0, occupancyRate },
      };
    }

    const [
      revenueByMonth,
      occupancyTrend,
      totalRevenueResult,
      bookingStatsResult,
      avgStayResult,
      bookingSource,
      totalHotelGuests,
      guestsInPeriod,
    ] = await Promise.all([
      this.getRevenueByMonth(bookingIds, startDate, now),
      this.generateOccupancyTrend(thirtyDaysAgo, now),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice."bookingId" IN (:...bookingIds)', { bookingIds })
        .getRawOne(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select('COALESCE(SUM(booking.totalPrice), 0)', 'revenue')
        .addSelect('COUNT(*)', 'count')
        .addSelect(
          `COALESCE(SUM(EXTRACT(EPOCH FROM (booking."checkOut" - booking."checkIn")) / 86400), 0)`,
          'nights',
        )
        .where('booking.id IN (:...bookingIds)', { bookingIds })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
          ],
        })
        .getRawOne(),
      this.bookingRepository
        .createQueryBuilder('booking')
        .select(
          `COALESCE(AVG(EXTRACT(EPOCH FROM (booking."checkOut" - booking."checkIn")) / 86400), 0)`,
          'avgStay',
        )
        .where('booking.id IN (:...bookingIds)', { bookingIds })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: [
            BookingStatus.CONFIRMED,
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
          ],
        })
        .getRawOne(),
      this.getBookingSourceDistribution(),
      this.guestRepository
        .createQueryBuilder('guest')
        .innerJoin(Booking, 'booking', 'booking."guestId" = guest.id')
        .where('booking.id IN (:...bookingIds)', { bookingIds })
        .select('COUNT(DISTINCT guest.id)', 'count')
        .getRawOne(),
      this.guestRepository
        .createQueryBuilder('guest')
        .innerJoin(Booking, 'booking', 'booking."guestId" = guest.id')
        .where('booking.id IN (:...bookingIds)', { bookingIds })
        .andWhere('booking."createdAt" BETWEEN :start AND :end', { start: startDate, end: now })
        .select('COUNT(DISTINCT guest.id)', 'count')
        .getRawOne(),
    ]);

    const totalBookingRevenue = Number(bookingStatsResult?.revenue || 0);
    const totalNights = Number(bookingStatsResult?.nights || 0);
    const totalGuestsCount = Number(totalHotelGuests?.count || 0);
    const guestsInPeriodCount = Number(guestsInPeriod?.count || 0);
    const avgDailyRate =
      totalNights > 0 ? Math.round(totalBookingRevenue / totalNights) : 0;
    const revenuePAR =
      totalRooms > 0
        ? Math.round(
            totalBookingRevenue /
              (totalRooms *
                Math.max(
                  1,
                  Math.round(
                    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )),
          )
        : 0;

    // Booking distribution (by source as percentages for admin pie chart)
    const bookingDistribution = bookingSource.length > 0
      ? bookingSource.map((r: any) => ({ name: r.name, value: r.value }))
      : [];

    return {
      revenueByMonth,
      revenueTrend: revenueByMonth.map((r: any) => ({
        date: r.month,
        revenue: r.revenue,
      })),
      occupancyTrend,
      bookingSource,
      bookingDistribution,
      guestStatistics: {
        totalGuests: totalGuestsCount,
        newGuests: guestsInPeriodCount,
        returningGuests: Math.max(0, totalGuestsCount - guestsInPeriodCount),
        averageStay: Number(
          Number(avgStayResult?.avgStay || 0).toFixed(1),
        ),
      },
      financialMetrics: {
        totalRevenue: Number(totalRevenueResult?.revenue || 0),
        averageDailyRate: avgDailyRate,
        revenuePAR,
        occupancyRate,
        revPAR: revenuePAR,
      },
    };
  }

  async getBookingSourceDistribution() {
    const rows = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('booking.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('booking.source')
      .getRawMany();

    const sourceColors: Record<string, string> = {
      direct: '#C9973A',
      bookingcom: '#0F1B2D',
      expedia: '#8b5cf6',
      agoda: '#10b981',
      phone: '#f59e0b',
      walk_in: '#ef4444',
      email: '#3b82f6',
      other: '#6b7280',
    };

    return rows.map((r) => ({
      name: r.source || 'other',
      value: Number(r.count),
      color: sourceColors[r.source?.toLowerCase()] || sourceColors.other,
    }));
  }

  async generateHeatmap(days: number = 14) {
    const rooms = await this.roomRepository.find({ order: { roomNumber: 'ASC' } });
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    const endDateStr = endDate.toISOString().split('T')[0];
    const dateStrs: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      dateStrs.push(d.toISOString().split('T')[0]);
    }

    // Query room_nights for per-date status
    const roomNights = await this.roomNightRepository.find({
      where: {
        date: Between(dateStrs[0], endDateStr),
      },
      relations: ['booking'],
    });

    const roomNightMap: Record<string, Record<string, { status: RoomNightStatus; bookingStatus?: string }>> = {};
    for (const rn of roomNights) {
      if (!roomNightMap[rn.roomId]) roomNightMap[rn.roomId] = {};
      roomNightMap[rn.roomId][rn.date] = {
        status: rn.status,
        bookingStatus: rn.booking?.status,
      };
    }

    return rooms.map(room => {
      const dates: string[] = [];
      for (let i = 0; i < days; i++) {
        const dStr = dateStrs[i];

        // Room physical status takes priority
        if (room.status === RoomStatus.MAINTENANCE || room.status === RoomStatus.OUT_OF_ORDER) {
          dates.push('out_of_order');
          continue;
        }

        const rn = roomNightMap[room.id]?.[dStr];
        if (rn) {
          if (rn.status === RoomNightStatus.BLOCKED) {
            dates.push('blocked');
          } else if (rn.status === RoomNightStatus.HELD || rn.bookingStatus === BookingStatus.HOLD) {
            dates.push('hold');
          } else {
            dates.push('confirmed');
          }
        } else {
          dates.push('available');
        }
      }
      return {
        room: room.roomNumber,
        dates,
      };
    });
  }

  private async getRevenueByMonth(
    bookingIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<{ month: string; revenue: number }[]> {
    const rows = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select(
        `TO_CHAR(invoice."updatedAt", 'YYYY-MM')`,
        'monthKey',
      )
      .addSelect('COALESCE(SUM(invoice.amount), 0)', 'revenue')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID })
      .andWhere('invoice."updatedAt" BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere('invoice."bookingId" IN (:...bookingIds)', { bookingIds })
      .groupBy('monthKey')
      .orderBy('monthKey', 'ASC')
      .getRawMany();

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return rows.map((r) => {
      const monthIndex = parseInt(r.monthKey.split('-')[1], 10) - 1;
      return {
        month: monthNames[monthIndex] || r.monthKey,
        revenue: Number(r.revenue),
      };
    });
  }

  private async generateOccupancyTrend(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const occupancyData: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDay = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      const [occupied, total] = await Promise.all([
        this.roomRepository.count({
          where: {
            status: RoomStatus.OCCUPIED,
            updatedAt: Between(currentDate, nextDay),
          },
        }),
        this.roomRepository.count(),
      ]);

      occupancyData.push({
        date: currentDate.toISOString().split('T')[0],
        occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0,
        occupied,
        total,
      });

      currentDate.setTime(nextDay.getTime());
    }

    return occupancyData;
  }

  private async generateRevenueTrend(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const revenueData: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDay = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      const revenueResult = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice."updatedAt" BETWEEN :start AND :end', {
          start: currentDate,
          end: nextDay,
        })
        .getRawOne();

      revenueData.push({
        date: currentDate.toISOString().split('T')[0],
        revenue: Number(revenueResult?.revenue || 0),
      });

      currentDate.setTime(nextDay.getTime());
    }

    return revenueData;
  }

  private async generateBookingTrend(
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    const bookingData: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const nextDay = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

      const [confirmed, checkedIn] = await Promise.all([
        this.bookingRepository.count({
          where: {
            status: BookingStatus.CONFIRMED,
            createdAt: Between(currentDate, nextDay),
          },
        }),
        this.bookingRepository.count({
          where: {
            status: BookingStatus.CHECKED_IN,
            createdAt: Between(currentDate, nextDay),
          },
        }),
      ]);

      bookingData.push({
        date: currentDate.toISOString().split('T')[0],
        confirmed,
        checkedIn,
      });

      currentDate.setTime(nextDay.getTime());
    }

    return bookingData;
  }

  private calculateNights(checkIn: Date, checkOut: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((checkOut.getTime() - checkIn.getTime()) / oneDay);
  }
}
