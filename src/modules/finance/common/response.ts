export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
): SuccessResponse<T> {
  return { success: true, data, meta };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): SuccessResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
