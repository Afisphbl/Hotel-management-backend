import { Repository, FindManyOptions, ObjectLiteral } from 'typeorm';
import type { PaginatedResult } from '../dto/pagination.dto';

export type { PaginatedResult };

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
