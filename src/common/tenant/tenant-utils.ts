import { ForbiddenException } from '@nestjs/common';

/**
 * Validates that a schema name is safe to be used in a raw SQL query.
 * Only allows alphanumeric characters and underscores.
 * Throws a ForbiddenException if the schema name is invalid.
 */
export function assertSafeSchemaName(schemaName: string): string {
  if (!schemaName || !/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new ForbiddenException('Invalid tenant schema');
  }

  return schemaName;
}
