## 2025-05-15 - SQL Injection via Schema Name
**Vulnerability:** Raw SQL queries used to set `search_path` for multi-tenancy were using string interpolation with schema names derived from JWT payloads. Since schema names cannot be parameterized in `SET search_path` commands, this created a potential SQL injection vector.
**Learning:** Even internal identifiers like schema names must be strictly validated if they are derived from external input (like a JWT) and used in non-parameterizable SQL commands.
**Prevention:** Always validate identifiers against a strict whitelist (e.g., alphanumeric and underscores) using a utility like `assertSafeSchemaName` before interpolating them into SQL queries.
