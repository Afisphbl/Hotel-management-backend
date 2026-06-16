## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA flow was insecure because the second stage (`verify-2fa`) only required a raw `userId` to complete authentication, allowing a malicious actor who knows a user's ID to bypass the password check if 2FA was enabled.
**Learning:** Returning raw internal identifiers (like `userId`) as a continuation token for multi-step authentication flows is a critical vulnerability.
**Prevention:** Always use short-lived, cryptographically signed, and purpose-bound tokens (like `mfaToken`) to link different stages of an authentication flow.
