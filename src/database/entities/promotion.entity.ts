import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoomType } from './room-type.entity';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity({ name: 'promotions' })
export class Promotion extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  roomTypeId: string;

  @Column({ type: 'enum', enum: DiscountType })
  discountType: DiscountType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  discountValue: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => RoomType, { nullable: true })
  @JoinColumn({ name: 'roomTypeId' })
  roomType: RoomType;
}
