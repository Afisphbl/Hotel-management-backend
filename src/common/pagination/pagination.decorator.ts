import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PaginationParams as PaginationParamsInterface } from './pagination.interface';

export const PaginationParams = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PaginationParamsInterface => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const sortBy = typeof query.sortBy === 'string' && query.sortBy.trim()
      ? query.sortBy.trim()
      : undefined;
    const sortOrder: 'ASC' | 'DESC' | undefined =
      query.sortOrder === 'ASC' ? 'ASC' :
      query.sortOrder === 'DESC' ? 'DESC' :
      undefined;

    return { page, limit, skip, sortBy, sortOrder };
  },
);
