import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HousekeepingTask,
  TaskStatus,
} from '../../../database/entities/housekeeping-task.entity';
import { CreateTaskDto, UpdateTaskDto, QueryTaskDto } from '../dto/housekeeping.dto';

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectRepository(HousekeepingTask)
    private taskRepository: Repository<HousekeepingTask>,
  ) {}

  async findAll(query: QueryTaskDto) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.assignedTo) where.assignedTo = query.assignedTo;
    if (query.priority) where.priority = query.priority;
    if (query.roomId) where.roomId = query.roomId;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [items, total] = await this.taskRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<HousekeepingTask> {
    const task = await this.taskRepository.findOneBy({ id });
    if (!task) throw new NotFoundException('Housekeeping task not found');
    return task;
  }

  async create(dto: CreateTaskDto): Promise<HousekeepingTask> {
    return this.taskRepository.save(this.taskRepository.create(dto));
  }

  async update(id: string, dto: UpdateTaskDto): Promise<HousekeepingTask> {
    const task = await this.findById(id);
    if (dto.status === TaskStatus.COMPLETED) {
      (task as any).completedAt = new Date();
    }
    Object.assign(task, dto);
    return this.taskRepository.save(task);
  }

  async assign(id: string, staffId: string): Promise<HousekeepingTask> {
    const task = await this.findById(id);
    task.assignedTo = staffId;
    task.status = TaskStatus.ASSIGNED;
    return this.taskRepository.save(task);
  }

  async complete(id: string, notes?: string): Promise<HousekeepingTask> {
    const task = await this.findById(id);
    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    if (notes) task.notes = notes;
    return this.taskRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findById(id);
    await this.taskRepository.softRemove(task);
  }
}
