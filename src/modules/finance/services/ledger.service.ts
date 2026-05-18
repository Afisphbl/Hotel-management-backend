import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import { CreateLedgerEntryDto, QueryLedgerDto } from '../dto/ledger.dto';
import { paginate, PaginatedResult } from '../common/pagination';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
  ) {}

  async findAll(query: QueryLedgerDto): Promise<PaginatedResult<LedgerEntry>> {
    const where: any = {};
    if (query.accountId) where.accountId = query.accountId;
    if (query.referenceType) where.referenceType = query.referenceType;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.dateFrom || query.dateTo) {
      where.entryDate = {};
      if (query.dateFrom) where.entryDate.gte = query.dateFrom;
      if (query.dateTo) where.entryDate.lte = query.dateTo;
    }

    return paginate<LedgerEntry>(this.ledgerRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { entryDate: 'DESC' },
    });
  }

  async findById(id: string): Promise<LedgerEntry> {
    const entry = await this.ledgerRepository.findOneBy({ id });
    if (!entry) throw new NotFoundException('Ledger entry not found');
    return entry;
  }

  async create(dto: CreateLedgerEntryDto): Promise<LedgerEntry> {
    const entry = this.ledgerRepository.create({
      accountId: dto.accountId,
      debit: dto.debit,
      credit: dto.credit,
      currency: dto.currency || 'USD',
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      bookingId: dto.bookingId,
      description: dto.description,
      entryDate: new Date(),
    });
    return this.ledgerRepository.save(entry);
  }

  async getAccountBalance(accountId: string): Promise<number> {
    const result = await this.ledgerRepository
      .createQueryBuilder('entry')
      .where('entry.accountId = :accountId', { accountId })
      .select('SUM(entry.credit) - SUM(entry.debit)', 'balance')
      .getRawOne();
    return Number(result?.balance || 0);
  }

  async getTrialBalance(): Promise<{ accountId: string; balance: number }[]> {
    const accounts = await this.ledgerRepository
      .createQueryBuilder('entry')
      .select('entry.accountId', 'accountId')
      .addSelect('SUM(entry.credit) - SUM(entry.debit)', 'balance')
      .groupBy('entry.accountId')
      .getRawMany();
    return accounts.map((a) => ({
      accountId: a.accountId,
      balance: Number(a.balance || 0),
    }));
  }
}
