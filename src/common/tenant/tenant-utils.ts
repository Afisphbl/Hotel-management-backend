import { ForbiddenException } from '@nestjs/common';

/**
 * Asserts that a schema name is safe to use in raw SQL queries.
 * Only allows alphanumeric characters and underscores.
 * @param schemaName The schema name to validate.
 * @returns The validated schema name.
 * @throws ForbiddenException if the schema name is invalid.
 */
export function assertSafeSchemaName(schemaName: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new ForbiddenException('Invalid tenant schema');
  }
  return schemaName;
}
