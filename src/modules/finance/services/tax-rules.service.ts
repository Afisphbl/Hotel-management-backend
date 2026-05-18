import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxRule } from '../../../database/entities/tax-rule.entity';
import { CreateTaxRuleDto, UpdateTaxRuleDto, QueryTaxRuleDto } from '../dto/tax-rule.dto';
import { paginate, PaginatedResult } from '../common/pagination';

@Injectable()
export class TaxRulesService {
  constructor(
    @InjectRepository(TaxRule)
    private taxRuleRepository: Repository<TaxRule>,
  ) {}

  async findAll(query: QueryTaxRuleDto): Promise<PaginatedResult<TaxRule>> {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return paginate<TaxRule>(this.taxRuleRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { type: 'ASC', rate: 'DESC' },
    });
  }

  async findById(id: string): Promise<TaxRule> {
    const rule = await this.taxRuleRepository.findOneBy({ id });
    if (!rule) throw new NotFoundException('Tax rule not found');
    return rule;
  }

  async create(dto: CreateTaxRuleDto): Promise<TaxRule> {
    const rule = this.taxRuleRepository.create({
      name: dto.name,
      type: dto.type,
      rate: dto.rate,
      application: dto.application,
      isActive: dto.isActive ?? true,
      validFrom: dto.validFrom,
      validTo: dto.validTo,
      description: dto.description,
    });
    return this.taxRuleRepository.save(rule);
  }

  async update(id: string, dto: UpdateTaxRuleDto): Promise<TaxRule> {
    const rule = await this.findById(id);
    Object.assign(rule, dto);
    return this.taxRuleRepository.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findById(id);
    await this.taxRuleRepository.softRemove(rule);
  }
}
