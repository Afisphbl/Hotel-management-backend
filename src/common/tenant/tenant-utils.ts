import { InternalServerErrorException } from '@nestjs/common';

/**
 * Validates a schema name to prevent SQL injection in places where parameterization is not possible.
 * Only allows alphanumeric characters and underscores.
 *
 * @param schemaName The schema name to validate
 * @throws InternalServerErrorException if the schema name is invalid
 */
export function assertSafeSchemaName(schemaName: string): void {
  const safePattern = /^[a-zA-Z0-9_]+$/;
  if (!safePattern.test(schemaName)) {
    throw new InternalServerErrorException(
      `Invalid schema name: ${schemaName}`,
    );
  }
}
