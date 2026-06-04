import { ForbiddenException } from '@nestjs/common';

/**
 * Validates that a schema name contains only alphanumeric characters and underscores.
 * This is a critical security check to prevent SQL injection in raw queries where
 * the schema name is used in string interpolation.
 *
 * @param schemaName The schema name to validate
 * @returns The validated schema name
 * @throws ForbiddenException if the schema name is invalid
 */
export function validateSchemaName(schemaName: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new ForbiddenException('Invalid tenant schema name');
  }
  return schemaName;
}
