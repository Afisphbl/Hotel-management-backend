import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'room_types' }) // Default schema will be set by search_path
export class RoomType extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int' })
  baseCapacity: number;

  @Column({ type: 'int', default: 0 })
  maxExtraBeds: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  basePrice: number;
}
