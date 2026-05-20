import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PlatformTaxRule,
  PlatformTaxType,
  TaxApplicationMethod,
  TaxRuleStatus,
} from '../../database/entities/global/platform-tax-rule.entity';

@Injectable()
export class TaxRuleService {
  constructor(
    @InjectRepository(PlatformTaxRule)
    private taxRuleRepository: Repository<PlatformTaxRule>,
  ) {}

  async findAll(filter?: { country?: string; status?: TaxRuleStatus; type?: PlatformTaxType }): Promise<PlatformTaxRule[]> {
    const where: any = {};
    if (filter?.country) where.country = filter.country;
    if (filter?.status) where.status = filter.status;
    if (filter?.type) where.type = filter.type;
    return this.taxRuleRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<PlatformTaxRule> {
    const rule = await this.taxRuleRepository.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Tax rule not found');
    return rule;
  }

  async create(data: Partial<PlatformTaxRule>): Promise<PlatformTaxRule> {
    const existing = await this.taxRuleRepository.findOne({
      where: { name: data.name, country: data.country ?? null as any },
    });
    if (existing) {
      throw new ConflictException('Tax rule with this name already exists in the specified country');
    }
    const rule = this.taxRuleRepository.create(data);
    return this.taxRuleRepository.save(rule);
  }

  async update(id: string, data: Partial<PlatformTaxRule>): Promise<PlatformTaxRule> {
    const rule = await this.findById(id);
    Object.assign(rule, data);
    return this.taxRuleRepository.save(rule);
  }

  async delete(id: string): Promise<void> {
    const rule = await this.findById(id);
    await this.taxRuleRepository.remove(rule);
  }

  async getApplicableTaxes(country: string, region?: string): Promise<PlatformTaxRule[]> {
    const where: any[] = [{ country, status: TaxRuleStatus.ACTIVE }];
    if (region) {
      where.push({ country, region, status: TaxRuleStatus.ACTIVE });
    }
    const taxes = await this.taxRuleRepository.find({
      where: region ? where : where[0],
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return taxes;
  }
}
