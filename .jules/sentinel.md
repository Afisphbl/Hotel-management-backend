## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The `verify-2fa` endpoint allowed identifying users via a simple `userId` in the request body without verifying that the first authentication factor (password) had been successfully completed. This allowed an attacker to bypass the first factor and attempt to brute-force 2FA codes for any user.
**Learning:** Multi-step authentication processes must securely link stages. Relying on client-provided identifiers between steps creates an authentication bypass vulnerability.
**Prevention:** Use a signed, short-lived, single-purpose token (e.g., an `mfaToken`) generated upon successful completion of the first factor to carry identity and context to the subsequent factors.
