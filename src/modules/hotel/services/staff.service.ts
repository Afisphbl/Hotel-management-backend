import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Hotel } from '../../../database/entities/hotel.entity';
import {
  StaffRole,
  StaffStatus,
} from '../../../database/entities/staff.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
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
      role?: StaffRole;
      status?: StaffStatus;
      department?: string;
    },
  ) {
    const s = await this.getSchema(hotelId);
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions = [`"deletedAt" IS NULL`];
    const params: any[] = [];

    if (options.role) {
      params.push(options.role);
      conditions.push(`role = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options.department) {
      params.push(options.department);
      conditions.push(`department = $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const [rows, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${s}"."staff" WHERE ${where} ORDER BY "firstName" ASC, "lastName" ASC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${s}"."staff" WHERE ${where}`,
        params,
      ),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    return {
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, hotelId: string) {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${s}"."staff" WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Staff member not found');
    return rows[0];
  }

  async create(data: any, hotelId: string) {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `INSERT INTO "${s}"."staff" ("userId","firstName","lastName","email","phone","role","employmentType","status","hourlyRate","department","joinedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,NOW())) RETURNING *`,
      [
        data.userId ?? '',
        data.firstName,
        data.lastName,
        data.email,
        data.phone ?? null,
        data.role,
        data.employmentType ?? 'full_time',
        data.status ?? 'active',
        data.hourlyRate ?? null,
        data.department ?? null,
        data.joinedAt ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, data: any, hotelId: string) {
    const s = await this.getSchema(hotelId);
    const allowed = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'role',
      'employmentType',
      'status',
      'hourlyRate',
      'department',
    ];
    const fields: string[] = [];
    const params: any[] = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        fields.push(`"${key}" = $${params.length}`);
      }
    }
    if (!fields.length) return this.findById(id, hotelId);
    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE "${s}"."staff" SET ${fields.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException('Staff member not found');
    return rows[0];
  }

  async remove(id: string, hotelId: string) {
    const s = await this.getSchema(hotelId);
    await this.dataSource.query(
      `UPDATE "${s}"."staff" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
  }
}
