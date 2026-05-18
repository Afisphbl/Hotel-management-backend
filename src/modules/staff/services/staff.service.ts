import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../../../database/entities/staff.entity';
import { CreateStaffDto, UpdateStaffDto, QueryStaffDto } from '../dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async findAll(query: QueryStaffDto) {
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.department) where.department = query.department;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [items, total] = await this.staffRepository.findAndCount({
      where,
      order: { firstName: 'ASC', lastName: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Staff> {
    const staff = await this.staffRepository.findOneBy({ id });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async create(dto: CreateStaffDto): Promise<Staff> {
    return this.staffRepository.save(this.staffRepository.create(dto));
  }

  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    const staff = await this.findById(id);
    Object.assign(staff, dto);
    return this.staffRepository.save(staff);
  }

  async remove(id: string): Promise<void> {
    const staff = await this.findById(id);
    await this.staffRepository.softRemove(staff);
  }
}
