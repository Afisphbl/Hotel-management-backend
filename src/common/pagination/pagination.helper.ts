import {
  Repository,
  FindManyOptions,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { PaginatedResult } from './pagination.interface';

export async function paginate<T extends ObjectLiteral>(
  repository: Repository<T>,
  options: FindManyOptions<T> & { page?: number; limit?: number },
): Promise<PaginatedResult<T>> {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const [items, total] = await repository.findAndCount({
    ...options,
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function paginateQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 50,
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * limit;
  qb.skip(skip).take(limit);
  const [items, total] = await qb.getManyAndCount();
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
