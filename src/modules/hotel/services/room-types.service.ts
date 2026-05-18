import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomType } from '../../../database/entities/room-type.entity';
import { paginate, PaginatedResult } from '../common/pagination.helper';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectRepository(RoomType)
    private roomTypeRepository: Repository<RoomType>,
  ) {}

  async findAll(options: { page?: number; limit?: number }): Promise<PaginatedResult<RoomType>> {
    return paginate<RoomType>(this.roomTypeRepository, {
      page: options.page,
      limit: options.limit,
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<RoomType> {
    const type = await this.roomTypeRepository.findOneBy({ id });
    if (!type) throw new NotFoundException('Room type not found');
    return type;
  }

  async create(data: Partial<RoomType>): Promise<RoomType> {
    return this.roomTypeRepository.save(this.roomTypeRepository.create(data));
  }

  async update(id: string, data: Partial<RoomType>): Promise<RoomType> {
    const type = await this.findById(id);
    Object.assign(type, data);
    return this.roomTypeRepository.save(type);
  }

  async remove(id: string): Promise<void> {
    const type = await this.findById(id);
    await this.roomTypeRepository.softRemove(type);
  }
}
