import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../base.entity';

export enum SettingCategory {
  SMTP = 'smtp',
  PAYMENT_GATEWAY = 'payment_gateway',
  SYSTEM = 'system',
  COMPLIANCE = 'compliance',
}

@Entity({ name: 'global_settings', schema: 'global' })
export class GlobalSetting extends BaseEntity {
  @Column({ unique: true })
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({
    type: 'enum',
    enum: SettingCategory,
  })
  category: SettingCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isPublic: boolean; // If true, can be exposed to frontend
}
