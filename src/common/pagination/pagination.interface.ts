export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export function toPaginationMeta(
  result: PaginatedResult<unknown>,
): PaginationMeta {
  return {
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}
