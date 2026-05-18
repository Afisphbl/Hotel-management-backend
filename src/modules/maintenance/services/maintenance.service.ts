import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MaintenanceTicket,
  TicketStatus,
} from '../../../database/entities/maintenance-ticket.entity';
import { CreateTicketDto, UpdateTicketDto, QueryTicketDto } from '../dto/maintenance.dto';
import { PaginatedResult, paginate } from '../../../common/pagination';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private ticketRepository: Repository<MaintenanceTicket>,
  ) {}

  async findAll(query: QueryTicketDto): Promise<PaginatedResult<MaintenanceTicket>> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.roomId) where.roomId = query.roomId;
    if (query.assignedTo) where.assignedTo = query.assignedTo;

    return paginate<MaintenanceTicket>(this.ticketRepository, {
      page: query.page,
      limit: query.limit,
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<MaintenanceTicket> {
    const ticket = await this.ticketRepository.findOneBy({ id });
    if (!ticket) throw new NotFoundException('Maintenance ticket not found');
    return ticket;
  }

  async create(dto: CreateTicketDto): Promise<MaintenanceTicket> {
    return this.ticketRepository.save(this.ticketRepository.create(dto));
  }

  async update(id: string, dto: UpdateTicketDto): Promise<MaintenanceTicket> {
    const ticket = await this.findById(id);
    Object.assign(ticket, dto);
    return this.ticketRepository.save(ticket);
  }

  async assign(id: string, staffId: string): Promise<MaintenanceTicket> {
    const ticket = await this.findById(id);
    ticket.assignedTo = staffId;
    ticket.status = TicketStatus.ASSIGNED;
    return this.ticketRepository.save(ticket);
  }

  async resolve(id: string, notes?: string, cost?: number): Promise<MaintenanceTicket> {
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
