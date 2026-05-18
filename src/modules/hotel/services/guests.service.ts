import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Guest } from '../../../database/entities/guest.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

export class GuestSearchOptions {
  page?: number;
  limit?: number;
  search?: string;
  email?: string;
}

@Injectable()
export class GuestsService {
  constructor(
    @InjectRepository(Guest)
    private guestRepository: Repository<Guest>,
  ) {}

  async findAll(options: GuestSearchOptions): Promise<PaginatedResult<Guest>> {
    const where: any = {};

    if (options.search) {
      where.firstName = Like(`%${options.search}%`);
    }
    if (options.email) {
      where.email = options.email;
    }

    return paginate<Guest>(this.guestRepository, {
      page: options.page,
      limit: options.limit,
      where,
      order: { createdAt: 'DESC' },
    });
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
