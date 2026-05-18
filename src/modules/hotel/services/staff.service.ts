import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Staff,
  StaffRole,
  StaffStatus,
} from '../../../database/entities/staff.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    role?: StaffRole;
    status?: StaffStatus;
    department?: string;
  }): Promise<PaginatedResult<Staff>> {
    const where: any = {};
    if (options.role) where.role = options.role;
    if (options.status) where.status = options.status;
    if (options.department) where.department = options.department;

    return paginate<Staff>(this.staffRepository, {
      page: options.page,
      limit: options.limit,
      where,
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async findById(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOneBy({ id });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async create(data: Partial<Staff>): Promise<Staff> {
    return this.staffRepository.save(this.staffRepository.create(data));
  }

  async update(id: string, data: Partial<Staff>): Promise<Staff> {
    const staff = await this.findById(id);
    Object.assign(staff, data);
    return this.staffRepository.save(staff);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.findById(id);
    await this.staffRepository.softRemove(staff);
  }
}
