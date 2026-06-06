import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Hotel } from '../../../database/entities/hotel.entity';
import {
  HousekeepingTask,
  TaskStatus,
  TaskPriority,
} from '../../../database/entities/housekeeping-task.entity';
import { User } from '../../../database/entities/user.entity';
import { HotelUserAccess, HotelAccessStatus } from '../../../database/entities/hotel-user-access.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectRepository(HousekeepingTask)
    private taskRepository: Repository<HousekeepingTask>,
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    @InjectRepository(HotelUserAccess)
    private accessRepository: Repository<HotelUserAccess>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  private async getSchema(hotelId: string): Promise<string> {
    const hotel = await this.hotelRepository.findOne({
      where: { id: hotelId },
    });
    if (!hotel?.schemaName)
      throw new NotFoundException('Hotel schema not found');
    return hotel.schemaName.replace(/[^a-zA-Z0-9_]/g, '');
  }

  async findAll(
    hotelId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      assignedTo?: string;
      priority?: string;
      roomId?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const s = await this.getSchema(hotelId);

    // 1. Get all rooms of this hotel
    const rooms = await this.dataSource.query(
      `SELECT id, "roomNumber" FROM "${s}"."rooms" WHERE "deletedAt" IS NULL`,
    );
    const roomMap = {};
    rooms.forEach((r) => {
      roomMap[r.id] = r;
    });
    const roomIds = rooms.map((r) => r.id);

    if (roomIds.length === 0) {
      return {
        items: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 15,
        totalPages: 0,
      };
    }

    // 2. Get all staff of this hotel
    const staffList = await this.dataSource.query(
      `SELECT id, "firstName", "lastName" FROM "${s}"."staff" WHERE "deletedAt" IS NULL`,
    );
    const staffMap = {};
    staffList.forEach((st) => {
      staffMap[st.id] = st;
    });

    // 3. Build where conditions
    const where: any = {
      roomId: In(roomIds),
    };

    // Handle status mapping
    if (options.status && options.status !== 'ALL') {
      const statusMap: Record<string, TaskStatus> = {
        PENDING: TaskStatus.PENDING,
        ASSIGNED: TaskStatus.ASSIGNED,
        IN_PROGRESS: TaskStatus.IN_PROGRESS,
        COMPLETED: TaskStatus.COMPLETED,
        VERIFIED: TaskStatus.VERIFIED,
      };
      const targetStatus =
        statusMap[options.status.toUpperCase()] ||
        (options.status.toLowerCase() as TaskStatus);
      where.status = targetStatus;
    }

    // Handle priority mapping
    if (options.priority && options.priority !== 'ALL') {
      const priorityMap: Record<string, TaskPriority> = {
        LOW: TaskPriority.LOW,
        NORMAL: TaskPriority.MEDIUM,
        MEDIUM: TaskPriority.MEDIUM,
        HIGH: TaskPriority.HIGH,
        URGENT: TaskPriority.URGENT,
      };
      const targetPriority =
        priorityMap[options.priority.toUpperCase()] ||
        (options.priority.toLowerCase() as TaskPriority);
      where.priority = targetPriority;
    }

    if (options.roomId) {
      const matchingRoom = rooms.find(
        (r) => r.id === options.roomId || r.roomNumber === options.roomId,
      );
      if (matchingRoom) {
        where.roomId = matchingRoom.id;
      } else {
        where.roomId = options.roomId;
      }
    }

    if (options.assignedTo) {
      where.assignedTo = options.assignedTo;
    }

    const paginatedResult = await paginate<HousekeepingTask>(
      this.taskRepository,
      {
        page: options.page,
        limit: options.limit,
        where,
        order: { createdAt: 'DESC' },
      },
    );

    // 4. Map results
    const items = paginatedResult.items.map((task) => {
      const room = roomMap[task.roomId];
      const staff = task.assignedTo ? staffMap[task.assignedTo] : null;

      const priorityInvMap: Record<TaskPriority, string> = {
        [TaskPriority.LOW]: 'LOW',
        [TaskPriority.MEDIUM]: 'NORMAL',
        [TaskPriority.HIGH]: 'HIGH',
        [TaskPriority.URGENT]: 'URGENT',
      };

      const statusInvMap: Record<TaskStatus, string> = {
        [TaskStatus.PENDING]: 'PENDING',
        [TaskStatus.ASSIGNED]: 'ASSIGNED',
        [TaskStatus.IN_PROGRESS]: 'IN_PROGRESS',
        [TaskStatus.COMPLETED]: 'COMPLETED',
        [TaskStatus.VERIFIED]: 'VERIFIED',
      };

      return {
        ...task,
        room: room ? room.roomNumber : task.roomId,
        roomNumber: room ? room.roomNumber : null,
        assignedToName: staff ? `${staff.firstName} ${staff.lastName}` : null,
        priority: priorityInvMap[task.priority] || 'NORMAL',
        status: statusInvMap[task.status] || 'PENDING',
      };
    });

    return {
      ...paginatedResult,
      items,
    };
  }

  async findById(id: string, hotelId: string): Promise<HousekeepingTask> {
    const task = await this.taskRepository.findOneBy({ id });
    if (!task) throw new NotFoundException('Task not found');

    const s = await this.getSchema(hotelId);
    const roomCheck = await this.dataSource.query(
      `SELECT id FROM "${s}"."rooms" WHERE id = $1 AND "deletedAt" IS NULL`,
      [task.roomId],
    );
    if (roomCheck.length === 0) {
      throw new NotFoundException('Task not found for this property');
    }

    return task;
  }

  async create(hotelId: string, data: any): Promise<HousekeepingTask> {
    const s = await this.getSchema(hotelId);

    let targetRoomId = data.roomId;
    const roomQuery = await this.dataSource.query(
      `SELECT id FROM "${s}"."rooms" WHERE (id = $1 OR "roomNumber" = $2) AND "deletedAt" IS NULL`,
      [data.roomId, data.roomId],
    );
    if (roomQuery.length > 0) {
      targetRoomId = roomQuery[0].id;
    } else {
      throw new NotFoundException(`Room '${data.roomId}' not found`);
    }

    const priorityMap: Record<string, TaskPriority> = {
      LOW: TaskPriority.LOW,
      NORMAL: TaskPriority.MEDIUM,
      MEDIUM: TaskPriority.MEDIUM,
      HIGH: TaskPriority.HIGH,
      URGENT: TaskPriority.URGENT,
    };
    const targetPriority = data.priority
      ? priorityMap[data.priority.toUpperCase()] || TaskPriority.MEDIUM
      : TaskPriority.MEDIUM;

    const statusMap: Record<string, TaskStatus> = {
      PENDING: TaskStatus.PENDING,
      ASSIGNED: TaskStatus.ASSIGNED,
      IN_PROGRESS: TaskStatus.IN_PROGRESS,
      COMPLETED: TaskStatus.COMPLETED,
      VERIFIED: TaskStatus.VERIFIED,
    };
    const targetStatus = data.status
      ? statusMap[data.status.toUpperCase()] || TaskStatus.PENDING
      : TaskStatus.PENDING;

    const task = this.taskRepository.create({
      roomId: targetRoomId,
      assignedTo: data.assignedTo || null,
      description: data.description || '',
      priority: targetPriority,
      status: targetStatus,
      scheduledDate:
        data.scheduledDate || new Date().toISOString().split('T')[0],
    });

    return this.taskRepository.save(task);
  }

  async update(
    id: string,
    data: any,
    hotelId: string,
  ): Promise<HousekeepingTask> {
    const task = await this.findById(id, hotelId);
    const s = await this.getSchema(hotelId);

    if (data.roomId) {
      const roomQuery = await this.dataSource.query(
        `SELECT id FROM "${s}"."rooms" WHERE (id = $1 OR "roomNumber" = $2) AND "deletedAt" IS NULL`,
        [data.roomId, data.roomId],
      );
      if (roomQuery.length === 0) {
        throw new NotFoundException(`Room '${data.roomId}' not found`);
      }
      task.roomId = roomQuery[0].id;
    }

    if (data.status) {
      const statusMap: Record<string, TaskStatus> = {
        PENDING: TaskStatus.PENDING,
        ASSIGNED: TaskStatus.ASSIGNED,
        IN_PROGRESS: TaskStatus.IN_PROGRESS,
        COMPLETED: TaskStatus.COMPLETED,
        VERIFIED: TaskStatus.VERIFIED,
      };
      const mappedStatus =
        statusMap[data.status.toUpperCase()] ||
        (data.status.toLowerCase() as TaskStatus);
      task.status = mappedStatus;

      if (mappedStatus === TaskStatus.COMPLETED) {
        task.completedAt = new Date();
      }
    }

    if (data.priority) {
      const priorityMap: Record<string, TaskPriority> = {
        LOW: TaskPriority.LOW,
        NORMAL: TaskPriority.MEDIUM,
        MEDIUM: TaskPriority.MEDIUM,
        HIGH: TaskPriority.HIGH,
        URGENT: TaskPriority.URGENT,
      };
      task.priority =
        priorityMap[data.priority.toUpperCase()] ||
        (data.priority.toLowerCase() as TaskPriority);
    }

    if (data.description !== undefined) task.description = data.description;
    if (data.notes !== undefined) task.notes = data.notes;
    if (data.scheduledDate !== undefined)
      task.scheduledDate = data.scheduledDate;

    return this.taskRepository.save(task);
  }

  async assign(
    id: string,
    staffId: string,
    hotelId: string,
  ): Promise<HousekeepingTask> {
    const task = await this.findById(id, hotelId);

    const s = await this.getSchema(hotelId);
    const staffQuery = await this.dataSource.query(
      `SELECT id FROM "${s}"."staff" WHERE id = $1 AND "deletedAt" IS NULL`,
      [staffId],
    );
    if (staffQuery.length === 0) {
      const access = await this.accessRepository.findOne({
        where: { id: staffId, hotelId, status: HotelAccessStatus.ACTIVE },
      });
      if (!access) {
        throw new NotFoundException(`Staff member not found`);
      }
      const user = await this.userRepository.findOne({
        where: { id: access.userId },
      });
      if (!user) {
        throw new NotFoundException(`Staff member not found`);
      }
      const existing = await this.dataSource.query(
        `SELECT id FROM "${s}"."staff" WHERE "userId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [user.id],
      );
      if (existing.length > 0) {
        task.assignedTo = existing[0].id;
      } else {
        const newStaff = await this.dataSource.query(
          `INSERT INTO "${s}"."staff" ("userId","firstName","lastName","email","role","status")
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [
            user.id,
            user.firstName || '',
            user.lastName || '',
            user.email || '',
            'housekeeping_staff',
            'active',
          ],
        );
        task.assignedTo = newStaff[0].id;
      }
    } else {
      task.assignedTo = staffId;
    }

    task.status = TaskStatus.ASSIGNED;
    return this.taskRepository.save(task);
  }

  async complete(
    id: string,
    notes?: string,
    hotelId?: string,
  ): Promise<HousekeepingTask> {
    const task = await this.findById(id, hotelId!);
    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();
    if (notes) task.notes = notes;
    return this.taskRepository.save(task);
  }

  async remove(id: string, hotelId: string): Promise<void> {
    const task = await this.findById(id, hotelId);
    await this.taskRepository.softRemove(task);
  }
}
