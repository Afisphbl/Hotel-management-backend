import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HousekeepingTask,
  TaskStatus,
  TaskPriority,
} from '../../../database/entities/housekeeping-task.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectRepository(HousekeepingTask)
    private taskRepository: Repository<HousekeepingTask>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: TaskStatus;
    assignedTo?: string;
    priority?: TaskPriority;
    roomId?: string;
  }): Promise<PaginatedResult<HousekeepingTask>> {
    const where: any = {};
    if (options.status) where.status = options.status;
    if (options.assignedTo) where.assignedTo = options.assignedTo;
    if (options.priority) where.priority = options.priority;
    if (options.roomId) where.roomId = options.roomId;

    return paginate<HousekeepingTask>(this.taskRepository, {
      page: options.page,
      limit: options.limit,
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<HousekeepingTask> {
    const task = await this.taskRepository.findOneBy({ id });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(data: Partial<HousekeepingTask>): Promise<HousekeepingTask> {
    return this.taskRepository.save(this.taskRepository.create(data));
  }

  async update(id: string, data: Partial<HousekeepingTask>): Promise<HousekeepingTask> {
    const task = await this.findById(id);
    if (data.status === TaskStatus.COMPLETED) {
      data.completedAt = new Date();
    }
    Object.assign(task, data);
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
