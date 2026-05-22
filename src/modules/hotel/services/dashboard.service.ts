import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import {
  Booking,
  BookingStatus,
} from '../../../database/entities/booking.entity';
import { Room, RoomStatus } from '../../../database/entities/room.entity';
import { Guest } from '../../../database/entities/guest.entity';
import {
  Invoice,
  InvoiceStatus,
} from '../../../database/entities/invoice.entity';
import { Payment, PaymentStatus } from '../../../database/entities/payment.entity';
import { Staff, StaffStatus } from '../../../database/entities/staff.entity';
import { Hotel } from '../../../database/entities/hotel.entity';

@Injectable()
export class DashboardService {
  constructor(
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
    const [
      totalStaff,
      activeStaff,
      todayShifts,
    ] = await Promise.all([
      this.staffRepository.count(),
      this.staffRepository.count({ where: { status: StaffStatus.ACTIVE } }),
      this.staffRepository.count({
        where: {
          status: StaffStatus.ACTIVE,
        },
      }),
    ]);

    // Calculate occupancy rate
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const monthlyProfit = monthlyRevenue ? Number(monthlyRevenue.revenue) * 0.7 : 0; // Assuming 30% profit margin

    // Generate trend data for charts
    const occupancyTrend = await this.generateOccupancyTrend(monthStart, now);
    const revenueTrend = await this.generateRevenueTrend(monthStart, now);
    const bookingTrend = await this.generateBookingTrend(monthStart, now);

    // Recent bookings for activity feed
    const recentBookings = await this.bookingRepository.find({
      where: { status: BookingStatus.CONFIRMED },
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['guest'],
    });

    return {
      // Core metrics
      occupancy: occupancyRate,
      totalRooms,
      availableRooms,
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
      pendingInvoices,
      overdueInvoices,
      
      // Guest metrics
      totalGuests,
      
      // Staff metrics
      totalStaff,
      activeStaff,
      todayShifts,
      
      // Recent activities
      recentPayments: recentPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        createdAt: payment.createdAt,
        invoice: payment.invoice ? {
          id: payment.invoice.id,
          amount: payment.invoice.amount,
          status: payment.invoice.status
        } : null
      })),
      recentBookings: recentBookings.map(booking => ({
        id: booking.id,
        guestName: booking.guest ? `${booking.guest.firstName} ${booking.guest.lastName}`.trim() : 'N/A',
        roomNumber: booking.bookingRooms?.[0]?.room?.roomNumber || 'N/A',
        nights: this.calculateNights(booking.checkIn, booking.checkOut),
        status: booking.status,
        createdAt: booking.createdAt,
        totalPrice: booking.totalPrice
      })),

      
      // Chart data
      occupancyTrend,
      revenueTrend,
      bookingTrend,
    };
  }

  private async generateOccupancyTrend(startDate: Date, endDate: Date): Promise<any[]> {
    const occupancyData: any[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const nextDay = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      const [occupied, total] = await Promise.all([
        this.roomRepository.count({
          where: { 
            status: RoomStatus.OCCUPIED,
            updatedAt: Between(currentDate, nextDay)
          }
        }),
        this.roomRepository.count()
      ]);
      
      occupancyData.push({
        date: currentDate.toISOString().split('T')[0],
        occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0,
        occupied,
        total
      });
      
      currentDate.setTime(nextDay.getTime());
    }
    
    return occupancyData;
  }

  private async generateRevenueTrend(startDate: Date, endDate: Date): Promise<any[]> {
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
        revenue: Number(revenueResult?.revenue || 0)
      });
      
      currentDate.setTime(nextDay.getTime());
    }
    
    return revenueData;
  }

  private async generateBookingTrend(startDate: Date, endDate: Date): Promise<any[]> {
    const bookingData: any[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const nextDay = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      
      const [confirmed, checkedIn] = await Promise.all([
        this.bookingRepository.count({
          where: {
            status: BookingStatus.CONFIRMED,
            createdAt: Between(currentDate, nextDay)
          }
        }),
        this.bookingRepository.count({
          where: {
            status: BookingStatus.CHECKED_IN,
            createdAt: Between(currentDate, nextDay)
          }
        })
      ]);
      
      bookingData.push({
        date: currentDate.toISOString().split('T')[0],
        confirmed,
        checkedIn
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
