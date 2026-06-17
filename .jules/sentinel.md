## 2025-05-23 - MFA Authentication Bypass via User ID Exposure
**Vulnerability:** The login flow returned a raw `userId` when 2FA was required, which was then used in the `verify-2fa` endpoint without any cryptographic binding. This allowed potential authentication bypass or context confusion.
**Learning:** Returning internal identifiers as session markers in multi-step auth flows is insecure.
**Prevention:** Use short-lived, signed, purpose-bound tokens (e.g., `mfaToken`) to link authentication stages and preserve context (like `hotelId`).
