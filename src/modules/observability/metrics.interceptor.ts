import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const routePath =
          request?.route?.path ||
          request?.baseUrl ||
          request?.path ||
          'unknown';

        if (String(routePath).includes('metrics')) {
          return;
        }

        const finishedAt = process.hrtime.bigint();
        const durationSeconds = Number(finishedAt - startedAt) / 1_000_000_000;

        this.metricsService.observeHttpRequest({
          method: request?.method ?? 'UNKNOWN',
          route: String(routePath),
          statusCode: response?.statusCode ?? 500,
          durationSeconds,
        });
      }),
    );
  }
}
