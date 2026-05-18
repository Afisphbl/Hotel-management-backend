import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoomType } from './room-type.entity';

@Entity({ name: 'price_overrides' })
export class PriceOverride extends BaseEntity {
  @Column()
  roomTypeId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ nullable: true })
  createdBy: string;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomType;
}
