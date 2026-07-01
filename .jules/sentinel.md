## 2025-05-24 - S3 IDOR and Path Traversal in StorageController
**Vulnerability:** The `createPresignedUploadUrl` endpoint allowed users to specify an arbitrary `key` for S3 uploads, enabling IDOR (overwriting other tenants' files) and path traversal.
**Learning:** In multi-tenant applications, user-provided file paths must always be prefixed with a tenant identifier and sanitized using segment-based filtering rather than simple regex to prevent bypasses.
**Prevention:** Always enforce tenant isolation at the controller/service level by prepending `tenantId/` to all storage keys and sanitizing paths by splitting into segments and filtering out `..` or `.` sequences.
