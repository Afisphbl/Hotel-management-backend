import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function paginate<T extends ObjectLiteral>(
  repo: Repository<T>,
  options: {
    page?: number;
    limit?: number;
    where?: any;
    order?: any;
    relations?: string[];
  },
): Promise<PaginatedResult<T>> {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const [items, total] = await repo.findAndCount({
    where: options.where,
    order: options.order || { createdAt: 'DESC' },
    skip,
    take: limit,
    relations: options.relations,
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function paginateQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 50,
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * limit;
  qb.skip(skip).take(limit);

  const [items, total] = await qb.getManyAndCount();

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
