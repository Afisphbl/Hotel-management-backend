import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum TaxType {
  VAT = 'vat',
  SERVICE_CHARGE = 'service_charge',
  CITY_TAX = 'city_tax',
  TOURIST_TAX = 'tourist_tax',
  LUXURY_TAX = 'luxury_tax',
}

export enum TaxApplication {
  PER_NIGHT = 'per_night',
  PER_BOOKING = 'per_booking',
  PERCENTAGE = 'percentage',
}

@Entity({ name: 'tax_rules' })
export class TaxRule extends BaseEntity {
  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: TaxType,
  })
  type: TaxType;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  rate: number;

  @Column({
    type: 'enum',
    enum: TaxApplication,
    default: TaxApplication.PERCENTAGE,
  })
  application: TaxApplication;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'date', nullable: true })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string;

  @Column({ type: 'text', nullable: true })
  description: string;
}
