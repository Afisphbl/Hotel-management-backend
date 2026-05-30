import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Booking } from './booking.entity';
import { Room } from './room.entity';

@Entity({ name: 'booking_rooms' })
export class BookingRoom extends BaseEntity {
  @Column()
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  roomId: string;

  @Column({ nullable: true })
  roomTypeId: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'jsonb', nullable: true })
  nightPrices: { date: string; price: number }[];
}
