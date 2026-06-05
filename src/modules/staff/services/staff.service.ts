import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Staff } from '../../../database/entities/staff.entity';
import {
  CreateStaffDto,
  UpdateStaffDto,
  QueryStaffDto,
} from '../dto/staff.dto';
import { PaginatedResult, paginate } from '../../../common/pagination';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async findAll(query: QueryStaffDto): Promise<PaginatedResult<Staff>> {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.department) where.department = query.department;

    return paginate<Staff>(this.staffRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async findById(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOneBy({ id });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async create(dto: CreateStaffDto): Promise<Staff> {
    const data = { ...dto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    return this.staffRepository.save(this.staffRepository.create(data));
  }

  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findById(id);
    const data = { ...dto };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    Object.assign(staff, data);
    return this.staffRepository.save(staff);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.findById(id);
    await this.staffRepository.softRemove(staff);
  }
}
