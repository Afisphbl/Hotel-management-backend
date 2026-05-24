import { ForbiddenException } from '@nestjs/common';

/**
 * Validates a schema name to prevent SQL injection in raw queries.
 * Enforces a strict alphanumeric whitelist: /^[a-zA-Z0-9_]+$/
 */
export function assertSafeSchemaName(schemaName: string): string {
  if (!schemaName || !/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new ForbiddenException('Invalid tenant schema');
  }

  return schemaName;
}
