import { BadRequestException } from '@nestjs/common';

/**
 * Validates a schema name to prevent SQL injection.
 * Only allows alphanumeric characters and underscores.
 * @param schemaName The schema name to validate
 * @returns The validated schema name
 * @throws BadRequestException if the schema name is invalid
 */
export function validateSchemaName(schemaName: string): string {
  if (!schemaName || typeof schemaName !== 'string') {
    throw new BadRequestException('Invalid schema name: schema name is required');
  }

  // Strict whitelist: alphanumeric and underscores only
  const isValid = /^[a-zA-Z0-9_]+$/.test(schemaName);

  if (!isValid) {
    throw new BadRequestException(`Invalid schema name: ${schemaName}. Only alphanumeric characters and underscores are allowed.`);
  }

  return schemaName;
}
