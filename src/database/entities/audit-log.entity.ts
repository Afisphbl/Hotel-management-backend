import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  REFRESH_TOKEN = 'refresh_token',
  REVOKE_TOKEN = 'revoke_token',
  BOOKING_CREATE = 'booking_create',
  BOOKING_UPDATE = 'booking_update',
  BOOKING_CANCEL = 'booking_cancel',
  PAYMENT_CREATE = 'payment_create',
  PAYMENT_REFUND = 'payment_refund',
  PERMISSION_GRANT = 'permission_grant',
  PERMISSION_REVOKE = 'permission_revoke',
}

export enum AuditResource {
  USER = 'user',
  HOTEL = 'hotel',
  BOOKING = 'booking',
  GUEST = 'guest',
  ROOM = 'room',
  PAYMENT = 'payment',
  INVOICE = 'invoice',
  PERMISSION = 'permission',
  ROLE = 'role',
  REFRESH_TOKEN = 'refresh_token',
}

@Entity({ name: 'audit_logs', schema: 'global' })
@Index(['userId'])
@Index(['resourceType', 'resourceId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  hotelId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({
    type: 'enum',
    enum: AuditResource,
  })
  resourceType: AuditResource;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: any;

  @Column({ type: 'jsonb', nullable: true })
  newValues: any;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    requestId?: string;
    path?: string;
    method?: string;
  };

  @Column({ nullable: true })
  performedBy: string; // userId who performed the action
}
