import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, from, switchMap, finalize } from 'rxjs';
import { DataSource } from 'typeorm';
import { assertSafeSchemaName } from '../tenant/tenant-utils';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  constructor(private dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantSchema = request['tenant_schema'];

    if (!tenantSchema) {
      return next.handle();
    }

    return from(this.setupQueryRunner(request, tenantSchema)).pipe(
      switchMap(() => next.handle()),
      finalize(() => {
        const qr = request['queryRunner'];
        if (qr) {
          qr.release().catch((err) =>
            this.logger.error('Failed to release tenant queryRunner', err),
          );
        }
      }),
    );
  }

  private async setupQueryRunner(request: any, schema: string): Promise<void> {
    // Validate schema name to prevent SQL injection as it cannot be parameterized
    assertSafeSchemaName(schema);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.query(`SET search_path TO "${schema}", public`);
    request['queryRunner'] = queryRunner;
  }
}
