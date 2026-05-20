import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, IsNull } from 'typeorm';
import {
  ConsentRecord,
  ConsentType,
  ConsentStatus,
} from '../../database/entities/global/consent-record.entity';
import { GlobalSetting, SettingCategory } from '../../database/entities/global/global-setting.entity';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(ConsentRecord)
    private consentRepository: Repository<ConsentRecord>,
    private dataSource: DataSource,
  ) {}

  async recordConsent(data: {
    userId: string;
    hotelId?: string;
    type: ConsentType;
    granted: boolean;
    ipAddress?: string;
    userAgent?: string;
    policyVersion?: string;
  }): Promise<ConsentRecord> {
    const existing = await this.consentRepository.findOne({
      where: { userId: data.userId, type: data.type, status: ConsentStatus.GRANTED },
    });
    if (existing && data.granted) return existing;

    if (existing) {
      existing.status = ConsentStatus.REVOKED;
      existing.revokedAt = new Date();
      await this.consentRepository.save(existing);
    }

    const record = this.consentRepository.create({
      userId: data.userId,
      hotelId: data.hotelId,
      type: data.type,
      status: data.granted ? ConsentStatus.GRANTED : ConsentStatus.REVOKED,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      grantedAt: data.granted ? new Date() : undefined,
      revokedAt: data.granted ? undefined : new Date(),
      policyVersion: data.policyVersion,
    });
    return this.consentRepository.save(record);
  }

  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    return this.consentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async hasConsent(userId: string, type: ConsentType): Promise<boolean> {
    const record = await this.consentRepository.findOne({
      where: { userId, type, status: ConsentStatus.GRANTED },
      order: { createdAt: 'DESC' },
    });
    if (!record) return false;
    if (record.expiresAt && record.expiresAt < new Date()) return false;
    return true;
  }

  async revokeConsent(userId: string, type: ConsentType): Promise<void> {
    const records = await this.consentRepository.find({
      where: { userId, type, status: ConsentStatus.GRANTED },
    });
    for (const record of records) {
      record.status = ConsentStatus.REVOKED;
      record.revokedAt = new Date();
      await this.consentRepository.save(record);
    }
  }

  async getConsentSummary(userId: string): Promise<Record<string, boolean>> {
    const types = Object.values(ConsentType);
    const summary: Record<string, boolean> = {};
    for (const type of types) {
      summary[type] = await this.hasConsent(userId, type);
    }
    return summary;
  }

  async cleanupExpiredConsents(): Promise<number> {
    const expired = await this.consentRepository.find({
      where: {
        status: ConsentStatus.GRANTED,
        expiresAt: LessThan(new Date()),
      },
    });
    for (const record of expired) {
      record.status = ConsentStatus.EXPIRED;
      await this.consentRepository.save(record);
    }
    this.logger.log(`Expired ${expired.length} consent records`);
    return expired.length;
  }
}
