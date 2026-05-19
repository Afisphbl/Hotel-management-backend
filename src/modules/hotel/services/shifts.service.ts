import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Shift, ShiftStatus } from '../../../database/entities/shift.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    staffId?: string;
    status?: ShiftStatus;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResult<Shift>> {
    const where: any = {};
    if (options.staffId) where.staffId = options.staffId;
    if (options.status) where.status = options.status;
    if (options.dateFrom && options.dateTo) {
      where.startTime = Between(
        new Date(options.dateFrom),
        new Date(options.dateTo),
      );
    }

    return paginate<Shift>(this.shiftRepository, {
      page: options.page,
      limit: options.limit,
      where,
      order: { startTime: 'DESC' },
    });
  }

  async findById(id: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOneBy({ id });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async create(data: Partial<Shift>): Promise<Shift> {
    return this.shiftRepository.save(this.shiftRepository.create(data));
  }

  async update(id: string, data: Partial<Shift>): Promise<Shift> {
    const shift = await this.findById(id);
    Object.assign(shift, data);
    return this.shiftRepository.save(shift);
  }

  async checkIn(id: string): Promise<Shift> {
    const shift = await this.findById(id);
    shift.status = ShiftStatus.CHECKED_IN;
    shift.checkInTime = new Date();
    return this.shiftRepository.save(shift);
  }

  async checkOut(id: string): Promise<Shift> {
    const shift = await this.findById(id);
    shift.status = ShiftStatus.CHECKED_OUT;
    shift.checkOutTime = new Date();
    return this.shiftRepository.save(shift);
  }

  async cancel(id: string): Promise<Shift> {
    const shift = await this.findById(id);
    shift.status = ShiftStatus.CANCELLED;
    return this.shiftRepository.save(shift);
  }

  async remove(id: string): Promise<void> {
    const shift = await this.findById(id);
    await this.shiftRepository.softRemove(shift);
  }
}
