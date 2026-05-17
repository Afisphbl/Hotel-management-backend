import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Room } from './room.entity';
import { Booking } from './booking.entity';

export enum RoomNightStatus {
  HELD = 'held',
  BOOKED = 'booked',
  BLOCKED = 'blocked',
}

@Entity({ name: 'room_nights' })
@Unique(['roomId', 'date'])
export class RoomNight extends BaseEntity {
  @Column()
  roomId: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({
    type: 'enum',
    enum: RoomNightStatus,
  })
  status: RoomNightStatus;

  @Column({ nullable: true })
  bookingId: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: number;
}
