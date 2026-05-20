import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from './hotel.entity';

@Entity({ name: 'tenant_quotas', schema: 'global' })
@Index(['hotelId'], { unique: true })
export class TenantQuota extends BaseEntity {
  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column({ type: 'integer', default: 0 })
  maxUsers: number;

  @Column({ type: 'integer', default: 0 })
  maxRooms: number;

  @Column({ type: 'integer', default: 0 })
  maxStorageMb: number;

  @Column({ type: 'integer', default: 0 })
  currentUsers: number;

  @Column({ type: 'integer', default: 0 })
  currentRooms: number;

  @Column({ type: 'integer', default: 0 })
  currentStorageMb: number;
}
