import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoomType } from './room-type.entity';

@Entity({ name: 'seasonal_rates' })
export class SeasonalRate extends BaseEntity {
  @Column()
  name: string;

  @Column()
  roomTypeId: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  fixedPrice: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  multiplier: number;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomType;
}
