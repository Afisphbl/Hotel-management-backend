## 2025-05-15 - [SQL Injection via Dynamic Schema Names]
**Vulnerability:** Raw SQL queries using string interpolation for PostgreSQL schema names in `SET search_path` and `FROM "schema"."table"` were vulnerable to SQL injection if tenant schema identifiers were maliciously crafted.
**Learning:** The application used ad-hoc regex sanitization (`.replace(/[^a-zA-Z0-9_]/g, '')`) which was inconsistent across the codebase and lacked a centralized enforcement mechanism.
**Prevention:** Centralized schema name validation via `validateSchemaName` utility that enforces a strict alphanumeric whitelist and fails securely (throws `ForbiddenException`) instead of silently sanitizing. All dynamic schema switching sites must use this utility.
