import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RoomType } from '../../../database/entities/room-type.entity';
import { Hotel } from '../../../database/entities/hotel.entity';

@Injectable()
export class RoomTypesService {
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
    },
  ) {
    const s = await this.getSchema(hotelId);
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${s}"."room_types" WHERE "deletedAt" IS NULL ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM "${s}"."room_types" WHERE "deletedAt" IS NULL`,
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

  async findById(id: string, hotelId: string): Promise<RoomType> {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${s}"."room_types" WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Room type not found');
    return rows[0];
  }

  async create(data: Partial<RoomType>, hotelId: string): Promise<RoomType> {
    const s = await this.getSchema(hotelId);
    const rows = await this.dataSource.query(
      `INSERT INTO "${s}"."room_types" (name, description, "baseCapacity", "maxExtraBeds", "basePrice")
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.baseCapacity,
        data.maxExtraBeds ?? 0,
        data.basePrice,
      ],
    );
    return rows[0];
  }

  async update(
    id: string,
    data: Partial<RoomType>,
    hotelId: string,
  ): Promise<RoomType> {
    const s = await this.getSchema(hotelId);
    const fields: string[] = [];
    const params: any[] = [];
    const allowed = [
      'name',
      'description',
      'baseCapacity',
      'maxExtraBeds',
      'basePrice',
    ];

    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        params.push((data as any)[key]);
        fields.push(`"${key}" = $${params.length}`);
      }
    }

    if (!fields.length) return this.findById(id, hotelId);

    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE "${s}"."room_types" SET ${fields.join(', ')}, "updatedAt" = NOW() 
       WHERE id = $${params.length} AND "deletedAt" IS NULL RETURNING *`,
      params,
    );

    if (!rows.length) throw new NotFoundException('Room type not found');
    return rows[0];
  }

  async remove(id: string, hotelId: string): Promise<void> {
    const s = await this.getSchema(hotelId);
    await this.dataSource.query(
      `UPDATE "${s}"."room_types" SET "deletedAt" = NOW() WHERE id = $1 AND "deletedAt" IS NULL`,
      [id],
    );
  }
}
