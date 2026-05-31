import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MaintenanceTicket,
  TicketStatus,
  TicketPriority,
} from '../../../database/entities/maintenance-ticket.entity';
import { paginateQuery, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private ticketRepository: Repository<MaintenanceTicket>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: TicketStatus;
    priority?: TicketPriority;
    roomId?: string;
    assignedTo?: string;
  }): Promise<PaginatedResult<MaintenanceTicket>> {
    const qb = this.ticketRepository
      .createQueryBuilder('t');

    if (options.status) qb.andWhere('t.status = :status', { status: options.status });
    if (options.priority) qb.andWhere('t.priority = :priority', { priority: options.priority });
    if (options.roomId) qb.andWhere('t.roomId = :roomId', { roomId: options.roomId });
    if (options.assignedTo) qb.andWhere('t.assignedTo = :assignedTo', { assignedTo: options.assignedTo });

    qb.orderBy('t.createdAt', 'DESC');

    return paginateQuery(qb, options.page ?? 1, options.limit ?? 50);
  }

  async findById(id: string): Promise<MaintenanceTicket> {
    const ticket = await this.ticketRepository.findOneBy({ id });
    if (!ticket) throw new NotFoundException('Maintenance ticket not found');
    return ticket;
  }

  async create(data: Partial<MaintenanceTicket>): Promise<MaintenanceTicket> {
    return this.ticketRepository.save(this.ticketRepository.create(data));
  }

  async update(
    id: string,
    data: Partial<MaintenanceTicket>,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.findById(id);
    if (data.status === TicketStatus.RESOLVED) {
      data.resolvedAt = new Date();
    }
    Object.assign(ticket, data);
    return this.ticketRepository.save(ticket);
  }

  async assign(id: string, staffId: string): Promise<MaintenanceTicket> {
    const ticket = await this.findById(id);
    ticket.assignedTo = staffId;
    ticket.status = TicketStatus.ASSIGNED;
    return this.ticketRepository.save(ticket);
  }

  async resolve(
    id: string,
    notes?: string,
    cost?: number,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.findById(id);
    ticket.status = TicketStatus.RESOLVED;
    ticket.resolvedAt = new Date();
    if (notes) ticket.notes = notes;
    if (cost !== undefined) ticket.cost = cost;
    return this.ticketRepository.save(ticket);
  }

  async remove(id: string): Promise<void> {
    const ticket = await this.findById(id);
    await this.ticketRepository.softRemove(ticket);
  }
}
