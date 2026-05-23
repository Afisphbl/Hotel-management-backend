import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoomType } from './room-type.entity';

export enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  DIRTY = 'dirty',
  MAINTENANCE = 'maintenance',
  OUT_OF_ORDER = 'out_of_order',
}

@Entity({ name: 'rooms' })
export class Room extends BaseEntity {
  @Column()
  roomNumber: string;

  @Column()
  floor: string;

  @Column()
  hotelId: string;

  @Column({ nullable: true })
  roomTypeId: string;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomType;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  basePrice: number;

  @Column({ type: 'int', nullable: true })
  baseCapacity: number;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  })
  status: RoomStatus;
}
