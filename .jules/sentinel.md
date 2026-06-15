# Sentinel Security Journal

## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA verification endpoint (`/auth/verify-2fa`) only required a `userId` and a 2FA code, allowing anyone with a valid 2FA code for a user to log in without knowing their password.
**Learning:** Decoupled multi-step authentication flows can introduce bypasses if the second step doesn't cryptographically verify that the first step (e.g., password check) was successful.
**Prevention:** Use short-lived, signed, purpose-bound tokens (like `mfaToken`) to link authentication steps.
