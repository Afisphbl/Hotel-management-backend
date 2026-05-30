import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'guests' })
export class Guest extends BaseEntity {
  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  phone: string; // PII

  @Column({ nullable: true })
  nationality: string;

  @Column({ default: false })
  isVip: boolean;

  @Column({ nullable: true })
  documentType: string; // PII

  @Column({ nullable: true })
  documentNumber: string; // PII

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  // Helper method to get non-PII data
  toSafeDTO() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      nationality: this.nationality,
      isVip: this.isVip,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Helper method to get full data with PII
  toFullDTO() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      nationality: this.nationality,
      isVip: this.isVip,
      documentType: this.documentType,
      documentNumber: this.documentNumber,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
