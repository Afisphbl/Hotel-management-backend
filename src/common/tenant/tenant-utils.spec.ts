import { ForbiddenException } from '@nestjs/common';
import { assertSafeSchemaName } from './tenant-utils';

describe('TenantUtils', () => {
  describe('assertSafeSchemaName', () => {
    it('should return the schema name if it is valid', () => {
      expect(assertSafeSchemaName('hotel_123')).toBe('hotel_123');
      expect(assertSafeSchemaName('GLOBAL')).toBe('GLOBAL');
      expect(assertSafeSchemaName('tenant_a_b_c')).toBe('tenant_a_b_c');
    });

    it('should throw ForbiddenException if the schema name contains special characters', () => {
      expect(() => assertSafeSchemaName('hotel; DROP TABLE users;')).toThrow(ForbiddenException);
      expect(() => assertSafeSchemaName('hotel-123')).toThrow(ForbiddenException);
      expect(() => assertSafeSchemaName('hotel 123')).toThrow(ForbiddenException);
      expect(() => assertSafeSchemaName('"public"')).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if the schema name is empty', () => {
      expect(() => assertSafeSchemaName('')).toThrow(ForbiddenException);
    });
  });
});
