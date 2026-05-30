import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Guest } from './guest.entity';
import { BookingRoom } from './booking-room.entity';

export enum BookingStatus {
  PENDING = 'pending',
  HOLD = 'hold',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NOSHOW = 'noshow',
}

@Entity({ name: 'bookings' })
export class Booking extends BaseEntity {
  @Column()
  guestId: string;

  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'guestId' })
  guest: Guest;

  @Column({ type: 'timestamptz' })
  checkIn: Date;

  @Column({ type: 'timestamptz' })
  checkOut: Date;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({ unique: true })
  idempotencyKey: string;

  @Column({ type: 'jsonb', nullable: true })
  priceSnapshot: any;

  @Column({ length: 50, nullable: true })
  source?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => BookingRoom, (br) => br.booking)
  bookingRooms: BookingRoom[];
}
