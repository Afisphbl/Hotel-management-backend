# Sentinel Security Journal

## 2025-05-15 - Centralized Schema Name Sanitization
**Vulnerability:** Multi-tenant applications using dynamic PostgreSQL schemas are vulnerable to SQL injection if schema names (e.g., `hotel_abc`) are used in raw SQL queries without strict validation. Previously, the codebase used inconsistent `replace()` regex calls (e.g., `/[^a-zA-Z0-9_]/g`) which were scattered and hard to audit.

**Learning:** Schema names and identifiers in PostgreSQL cannot be parameterized using standard prepared statement placeholders (e.g., `$1`). This makes them a frequent source of SQL injection in multi-tenant architectures if they are derived from external data (like JWT payloads or database fields) and then concatenated into raw queries.

**Prevention:** Enforce a centralized `validateSchemaName` utility that uses a strict whitelist (`/^[a-zA-Z0-9_]+$/`) for all dynamic schema references. This should be applied at the lowest possible layer, such as `TenantInterceptor` and `DatabaseModule` search path patching, as well as in all services performing cross-tenant or administrative schema operations.
