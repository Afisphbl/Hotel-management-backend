import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: string;
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

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && 'success' in value) {
          return value as SuccessResponse<T>;
        }
        return { success: true, data: value };
      }),
    );
  }
}
