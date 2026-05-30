import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThanOrEqual } from 'typeorm';
import { Guest } from '../../../database/entities/guest.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

export class GuestSearchOptions {
  page?: number;
  limit?: number;
  search?: string;
  email?: string;
  isVip?: boolean;
  nationality?: string;
  recent?: boolean;
}

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
  ) {}

  async findAll(options: GuestSearchOptions): Promise<PaginatedResult<Guest>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = [];

    if (options.search) {
      const searchPattern = Like(`%${options.search}%`);
      where.push({ firstName: searchPattern });
      where.push({ lastName: searchPattern });
      where.push({ email: searchPattern });
    } else {
      where.push({});
    }

    // Apply other filters to each OR condition
    for (const condition of where) {
      if (options.email) condition.email = options.email;
      if (options.isVip !== undefined) condition.isVip = options.isVip;
      if (options.nationality) condition.nationality = options.nationality;
      if (options.recent) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        condition.createdAt = MoreThanOrEqual(thirtyDaysAgo);
      }
    }

    const [items, total] = await this.guestRepository.findAndCount({
      where: where.length > 1 ? where : where[0],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Guest> {
    const guest = await this.guestRepository.findOneBy({ id });
    if (!guest) throw new NotFoundException('Guest not found');
    return guest;
  }

  async findByEmail(email: string): Promise<Guest | null> {
    return this.guestRepository.findOneBy({ email });
  }

  async create(data: Partial<Guest>): Promise<Guest> {
    if (data.email) {
      const existing = await this.findByEmail(data.email);
      if (existing) return existing;
    }
    return this.guestRepository.save(this.guestRepository.create(data));
  }

  async update(id: string, data: Partial<Guest>): Promise<Guest> {
    const guest = await this.findById(id);
    Object.assign(guest, data);
    return this.guestRepository.save(guest);
  }

  async remove(id: string): Promise<void> {
    const guest = await this.findById(id);
    await this.guestRepository.softRemove(guest);
  }
}
