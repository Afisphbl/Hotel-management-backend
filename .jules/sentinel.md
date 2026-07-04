## 2025-05-23 - S3 Path Traversal and Tenant Isolation
**Vulnerability:** The `StorageController.createPresignedUploadUrl` endpoint was vulnerable to path traversal and lacked tenant isolation. It accepted a user-provided `key` and passed it directly to S3's `getPresignedPutUrl`. An attacker could provide a key like `../../../dangerous/path/file.jpg` to upload files outside of their intended scope, potentially overwriting other tenants' files or accessing sensitive areas of the S3 bucket if permissions were overly permissive.

**Learning:** Trusting user input for file paths or S3 keys without sanitization and tenant-specific prefixing is a common source of security vulnerabilities in multi-tenant applications. Even with authentication and authorization, a user should only be able to interact with data belonging to their own tenant.

**Prevention:** Always sanitize user-provided file paths/keys by removing path traversal sequences (e.g., `../`). Furthermore, always prefix these keys with a tenant-unique identifier (e.g., `hotels/{hotelId}/`) at the application level to ensure strict logical isolation within shared resources like S3 buckets.
