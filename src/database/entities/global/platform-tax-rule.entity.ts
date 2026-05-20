import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum PlatformTaxType {
  VAT = 'vat',
  SERVICE_CHARGE = 'service_charge',
  CITY_TAX = 'city_tax',
  TOURIST_TAX = 'tourist_tax',
  LUXURY_TAX = 'luxury_tax',
  SALES_TAX = 'sales_tax',
  GST = 'gst',
}

export enum TaxApplicationMethod {
  PER_NIGHT = 'per_night',
  PER_BOOKING = 'per_booking',
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum TaxRuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SCHEDULED = 'scheduled',
}

@Entity({ name: 'platform_tax_rules', schema: 'global' })
@Index(['country', 'region', 'status'])
@Index(['type', 'status'])
export class PlatformTaxRule extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: PlatformTaxType })
  type: PlatformTaxType;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  rate: number;

  @Column({ type: 'enum', enum: TaxApplicationMethod, default: TaxApplicationMethod.PERCENTAGE })
  applicationMethod: TaxApplicationMethod;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  region: string;

  @Column({ type: 'enum', enum: TaxRuleStatus, default: TaxRuleStatus.ACTIVE })
  status: TaxRuleStatus;

  @Column({ type: 'date', nullable: true })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
