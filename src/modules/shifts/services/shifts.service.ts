import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Shift, ShiftStatus } from '../../../database/entities/shift.entity';
import {
  CreateShiftDto,
  UpdateShiftDto,
  QueryShiftDto,
} from '../dto/shift.dto';
import { PaginatedResult, paginate } from '../../../common/pagination';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftRepository: Repository<Shift>,
  ) {}

  async findAll(query: QueryShiftDto): Promise<PaginatedResult<Shift>> {
    const where: any = {};
    if (query.staffId) where.staffId = query.staffId;
    if (query.status) where.status = query.status;
    if (query.dateFrom && query.dateTo) {
      where.startTime = Between(
        new Date(query.dateFrom),
        new Date(query.dateTo),
      );
    }

    return paginate<Shift>(this.shiftRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { startTime: 'DESC' },
    });
  }

  async findById(id: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOneBy({ id });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async create(dto: CreateShiftDto): Promise<Shift> {
    return this.shiftRepository.save(
      this.shiftRepository.create({
        staffId: dto.staffId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        status: dto.status,
        notes: dto.notes,
      }),
    );
  }

  async update(id: string, dto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findById(id);
    Object.assign(shift, {
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : shift.startTime,
      endTime: dto.endTime ? new Date(dto.endTime) : shift.endTime,
    });
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
}
