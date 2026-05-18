import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../../../database/entities/booking.entity';
import { Room, RoomStatus } from '../../../database/entities/room.entity';
import { Guest } from '../../../database/entities/guest.entity';
import { Invoice, InvoiceStatus } from '../../../database/entities/invoice.entity';

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
  ) {}

  async getDashboard() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      totalRooms,
      availableRooms,
      occupiedRooms,
      dirtyRooms,
      maintenanceRooms,
      todayCheckIns,
      todayCheckOuts,
      activeBookings,
      todayRevenue,
      totalGuests,
      pendingInvoices,
    ] = await Promise.all([
      this.roomRepository.count(),
      this.roomRepository.count({ where: { status: RoomStatus.AVAILABLE } }),
      this.roomRepository.count({ where: { status: RoomStatus.OCCUPIED } }),
      this.roomRepository.count({ where: { status: RoomStatus.DIRTY } }),
      this.roomRepository.count({ where: { status: RoomStatus.MAINTENANCE } }),
      this.bookingRepository.count({
        where: {
          status: BookingStatus.CONFIRMED,
          checkIn: todayStart.toISOString() as any,
        },
      }),
      this.bookingRepository.count({
        where: {
          status: BookingStatus.CHECKED_IN,
          checkOut: todayStart.toISOString() as any,
        },
      }),
      this.bookingRepository.count({
        where: {
          status: BookingStatus.CONFIRMED,
        },
      }),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amount), 0)', 'revenue')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice."updatedAt" BETWEEN :start AND :end', {
          start: todayStart,
          end: todayEnd,
        })
        .getRawOne(),
      this.guestRepository.count(),
      this.invoiceRepository.count({
        where: { status: InvoiceStatus.ISSUED },
      }),
    ]);

    return {
      occupancy: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      totalRooms,
      availableRooms,
      occupiedRooms,
      dirtyRooms,
      maintenanceRooms,
      todayCheckIns,
      todayCheckOuts,
      activeBookings,
      todayRevenue: Number(todayRevenue?.revenue || 0),
      totalGuests,
      pendingInvoices,
    };
  }
}
