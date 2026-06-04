import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  MaintenanceTicket,
  TicketStatus,
  TicketPriority,
} from '../../../database/entities/maintenance-ticket.entity';
import { Room } from '../../../database/entities/room.entity';
import { User } from '../../../database/entities/user.entity';
import { Staff } from '../../../database/entities/staff.entity';
import { LedgerEntry } from '../../../database/entities/ledger-entry.entity';
import { paginateQuery, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceTicket)
    private ticketRepository: Repository<MaintenanceTicket>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(LedgerEntry)
    private ledgerRepository: Repository<LedgerEntry>,
  ) {}

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: TicketStatus;
    priority?: TicketPriority;
    roomId?: string;
    assignedTo?: string;
  }): Promise<PaginatedResult<MaintenanceTicket>> {
    const qb = this.ticketRepository.createQueryBuilder('t');

    if (options.status)
      qb.andWhere('t.status = :status', { status: options.status });
    if (options.priority)
      qb.andWhere('t.priority = :priority', { priority: options.priority });
    if (options.roomId)
      qb.andWhere('t.roomId = :roomId', { roomId: options.roomId });
    if (options.assignedTo)
      qb.andWhere('t.assignedTo = :assignedTo', {
        assignedTo: options.assignedTo,
      });

    qb.orderBy('t.createdAt', 'DESC');

    const result = await paginateQuery(
      qb,
      options.page ?? 1,
      options.limit ?? 50,
    );

    if (!result.items.length) return result;

    const roomIds = [
      ...new Set(result.items.map((t) => t.roomId).filter(Boolean)),
    ];
    const userIds = [
      ...new Set(result.items.map((t) => t.reportedBy).filter(Boolean)),
    ];
    const assigneeIds = [
      ...new Set(result.items.map((t) => t.assignedTo).filter(Boolean)),
    ];

    const [rooms, reporters, assignees] = await Promise.all([
      roomIds.length
        ? this.roomRepository.findBy({ id: In(roomIds) })
        : Promise.resolve([]),
      userIds.length
        ? this.userRepository.findBy({ id: In(userIds) })
        : Promise.resolve([]),
      assigneeIds.length
        ? this.staffRepository.findBy({ id: In(assigneeIds) })
        : Promise.resolve([]),
    ]);

    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const userMap = new Map(reporters.map((u) => [u.id, u]));
    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

    (result.items as any[]) = result.items.map((t) => ({
      ...t,
      room: roomMap.get(t.roomId) || null,
      reporter: userMap.get(t.reportedBy) || null,
      assignedToName: assigneeMap.has(t.assignedTo)
        ? `${assigneeMap.get(t.assignedTo)!.firstName} ${assigneeMap.get(t.assignedTo)!.lastName}`
        : null,
    }));

    return result;
  }

  async getStats() {
    const results = await this.ticketRepository
      .createQueryBuilder('t')
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.status')
      .getRawMany<{ status: string; count: string }>();

    let total = 0;
    let open = 0;
    let inProgress = 0;
    let completed = 0;

    for (const r of results) {
      const c = parseInt(r.count);
      total += c;
      if (r.status === 'reported' || r.status === 'assigned') open += c;
      else if (r.status === 'in_progress') inProgress += c;
      else if (r.status === 'resolved' || r.status === 'closed') completed += c;
    }

    return { total, open, inProgress, completed };
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
    const saved = await this.ticketRepository.save(ticket);

    if (cost !== undefined && cost > 0) {
      await this.ledgerRepository.save({
        accountId: 'MAINTENANCE_EXPENSE',
        debit: cost,
        credit: 0,
        currency: 'ETB',
        referenceType: 'MAINTENANCE',
        referenceId: saved.id,
        entryDate: new Date(),
        description: `Maintenance cost: ${ticket.title}`,
      });
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    const ticket = await this.findById(id);
    await this.ticketRepository.softRemove(ticket);
  }
}
