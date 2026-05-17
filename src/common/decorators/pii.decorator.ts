import { SetMetadata } from '@nestjs/common';

export const PII_PERMISSION_KEY = 'pii_permission';

export const RequirePiiPermission = (permission: string = 'guests:pii:read') =>
  SetMetadata(PII_PERMISSION_KEY, permission);
