import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Room } from './room.entity';
import { Guest } from './guest.entity';

@Entity({ name: 'reviews' })
@Index(['roomId'])
@Index(['guestId'])
@Index(['hotelId'])
export class Review extends BaseEntity {
  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @Column()
  roomId: string;

  @ManyToOne(() => Room)
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @Column()
  guestId: string;

  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'guestId' })
  guest: Guest;

  @Column()
  hotelId: string;

  @Column({ default: true })
  isVisible: boolean;
}
