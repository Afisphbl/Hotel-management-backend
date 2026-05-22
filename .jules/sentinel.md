## 2025-05-15 - SQL Injection in Schema Identifiers
**Vulnerability:** Potential SQL injection in raw SQL queries where PostgreSQL schema names were interpolated directly into the query string without validation.
**Learning:** Standard SQL parameterization (e.g., `$1`) only works for data values, not for identifiers like schema, table, or column names.
**Prevention:** Always validate identifiers against a strict whitelist (e.g., `/^[a-zA-Z0-9_]+$/`) using the `assertSafeSchemaName` utility before interpolating them into SQL strings.
