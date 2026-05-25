import { InternalServerErrorException } from '@nestjs/common';
import { assertSafeSchemaName } from './tenant-utils';

describe('TenantUtils', () => {
  describe('assertSafeSchemaName', () => {
    it('should not throw for valid schema names', () => {
      expect(() => assertSafeSchemaName('hotel_123')).not.toThrow();
      expect(() => assertSafeSchemaName('global')).not.toThrow();
      expect(() => assertSafeSchemaName('my_schema_v1')).not.toThrow();
    });

    it('should throw for schema names with spaces', () => {
      expect(() => assertSafeSchemaName('hotel 123')).toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw for schema names with special characters', () => {
      expect(() => assertSafeSchemaName('hotel-123')).toThrow(
        InternalServerErrorException,
      );
      expect(() => assertSafeSchemaName('hotel; DROP TABLE users;')).toThrow(
        InternalServerErrorException,
      );
      expect(() => assertSafeSchemaName('"public"')).toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw for empty string', () => {
      expect(() => assertSafeSchemaName('')).toThrow(
        InternalServerErrorException,
      );
    });
  });
});
