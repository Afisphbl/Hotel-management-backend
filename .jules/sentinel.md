# Sentinel Security Journal

## 2025-05-23 - MFA Authentication Bypass via Missing Token Binding
**Vulnerability:** The 2FA verification endpoint (`/auth/verify-2fa`) accepted a raw `userId` and TOTP code, allowing anyone who knew a user's ID to attempt to brute-force the second factor without having completed the first factor (password) authentication.
**Learning:** Returning a raw user identifier for multi-step authentication flows creates a bypass opportunity where the second factor is not cryptographically bound to a successful first factor verification.
**Prevention:** Always use short-lived, signed, and purpose-bound tokens (e.g., `mfaToken`) to link authentication stages. These tokens should be generated only after successful verification of the preceding factor and must be verified before proceeding to the next stage.
