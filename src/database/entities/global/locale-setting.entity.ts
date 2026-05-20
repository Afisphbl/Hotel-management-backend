import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Hotel } from '../hotel.entity';

export enum DateFormat {
  DD_MM_YYYY = 'DD/MM/YYYY',
  MM_DD_YYYY = 'MM/DD/YYYY',
  YYYY_MM_DD = 'YYYY-MM-DD',
}

export enum TimeFormat {
  TWELVE_HOUR = '12h',
  TWENTY_FOUR_HOUR = '24h',
}

export enum FirstDayOfWeek {
  MONDAY = 'monday',
  SUNDAY = 'sunday',
  SATURDAY = 'saturday',
}

@Entity({ name: 'locale_settings', schema: 'global' })
@Index(['hotelId'], { unique: true })
export class LocaleSetting extends BaseEntity {
  @Column()
  hotelId: string;

  @ManyToOne(() => Hotel)
  @JoinColumn({ name: 'hotelId' })
  hotel: Hotel;

  @Column({ default: 'en' })
  language: string;

  @Column({ type: 'enum', enum: DateFormat, default: DateFormat.DD_MM_YYYY })
  dateFormat: DateFormat;

  @Column({
    type: 'enum',
    enum: TimeFormat,
    default: TimeFormat.TWENTY_FOUR_HOUR,
  })
  timeFormat: TimeFormat;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'GBP' })
  currency: string;

  @Column({
    type: 'enum',
    enum: FirstDayOfWeek,
    default: FirstDayOfWeek.MONDAY,
  })
  firstDayOfWeek: FirstDayOfWeek;

  @Column({ type: 'jsonb', nullable: true })
  supportedLanguages: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
