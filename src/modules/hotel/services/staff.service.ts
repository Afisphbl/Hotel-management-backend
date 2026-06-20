import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Hotel } from '../../../database/entities/hotel.entity';
import {
  StaffRole,
  StaffStatus,
} from '../../../database/entities/staff.entity';
import { PasswordPolicyService } from '../../../common/services/password-policy.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Hotel)
    private hotelRepository: Repository<Hotel>,
    private dataSource: DataSource,
    private readonly passwordPolicyService: PasswordPolicyService,
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
    const whereParams = [...params];
    params.push(limit, offset);
    const [rows, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${s}"."staff" WHERE ${where} ORDER BY "firstName" ASC, "lastName" ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${s}"."staff" WHERE ${where}`,
        whereParams,
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
    if (data.password) {
      await this.passwordPolicyService.assertCompliant(data.password);
    }
    const password = data.password
      ? await bcrypt.hash(data.password, 12)
      : null;
    const rows = await this.dataSource.query(
      `INSERT INTO "${s}"."staff" ("userId","firstName","lastName","email","password","phone","role","employmentType","status","hourlyRate","department","joinedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,NOW())) RETURNING *`,
      [
        data.userId ?? '',
        data.firstName,
        data.lastName,
        data.email,
        password,
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
      'password',
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
        let value = data[key];
        if (key === 'password') {
          await this.passwordPolicyService.assertCompliant(value);
          value = await bcrypt.hash(value, 12);
        }
        params.push(value);
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
