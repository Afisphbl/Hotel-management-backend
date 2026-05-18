import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoomType } from './room-type.entity';

@Entity({ name: 'rate_plans' })
export class RatePlan extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  roomTypeId: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  weekdayAdjustment: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  weekendAdjustment: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomType;
}
