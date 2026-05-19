import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/global';
import { AuditAction, AuditResource } from '../../database/entities/global/audit-log.entity';
import { Request } from 'express';

declare module 'express' {
  interface Request {
    session?: { id?: string };
  }
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async logAction(
    action: AuditAction,
    resource: AuditResource,
    resourceId: string,
    userId?: string,
    request?: Request,
    data?: Record<string, any>,
    changes?: Record<string, any>,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      user: userId ? { id: userId } : undefined,
      action,
      resource,
      resourceId,
      data,
      changes,
      ipAddress: this.getClientIp(request),
      userAgent: request?.headers['user-agent'],
      sessionId: request?.session?.id,
      createdAt: new Date(),
    });

    return this.auditLogRepository.save(auditLog);
  }

  private getClientIp(request?: Request): string {
    if (!request) {
      return 'unknown';
    }

    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }
}