export { PaginationDto } from './pagination.dto';
export type {
  PaginatedResult,
  PaginationMeta,
  PaginationParams,
} from './pagination.interface';
export { toPaginationMeta } from './pagination.interface';
export { PaginationParams as PaginationParamsDecorator } from './pagination.decorator';
export { paginate, paginateQuery } from './pagination.helper';

export function success<T>(data: T, meta?: Record<string, unknown>) {
  return { success: true as const, data, meta };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    success: true as const,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
