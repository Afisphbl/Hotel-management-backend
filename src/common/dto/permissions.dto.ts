import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
  EXECUTE = 'execute',
}

export enum PermissionResource {
  HOTEL = 'hotel',
  USER = 'user',
  BOOKING = 'booking',
  ROOM = 'room',
  GUEST = 'guest',
  PAYMENT = 'payment',
  INVOICE = 'invoice',
  STAFF = 'staff',
  SHIFT = 'shift',
  HOUSEKEEPING = 'housekeeping',
  MAINTENANCE = 'maintenance',
  FINANCE = 'finance',
  REPORT = 'report',
  CONFIGURATION = 'configuration',
}

export enum PermissionScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  RESOURCE = 'resource',
}

export class CreatePermissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  slug: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description: string;

  @IsEnum(PermissionAction)
  action: PermissionAction;

  @IsEnum(PermissionResource)
  resource: PermissionResource;

  @IsEnum(PermissionScope)
  scope: PermissionScope = PermissionScope.TENANT;

  @IsString()
  @MaxLength(50)
  category: string;
}

export class UpdatePermissionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string;
}

export class PermissionQueryDto {
  @IsEnum(PermissionResource)
  resource?: PermissionResource;

  @IsEnum(PermissionAction)
  action?: PermissionAction;

  @IsString()
  category?: string;
}

export class PermissionAssignmentDto {
  @IsString()
  roleId: string;

  @IsString()
  permissionId: string;
}

export class BulkPermissionAssignmentDto {
  @IsString()
  roleId: string;

  @IsString({ each: true })
  permissionIds: string[];
}
