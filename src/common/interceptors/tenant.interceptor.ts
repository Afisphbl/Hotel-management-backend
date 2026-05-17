import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantSchema = request['tenant_schema'];

    if (tenantSchema) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`SET search_path TO "${tenantSchema}", public`);
      
      // We attach the queryRunner to the request so repositories can use it
      request['queryRunner'] = queryRunner;

      try {
        return next.handle();
      } finally {
        // In a real app, you'd need to ensure the queryRunner is released properly
        // after the request is finished. This is often done in a teardown logic.
        // For now, we will handle this via a more robust Repository pattern later.
      }
    }

    return next.handle();
  }
}
