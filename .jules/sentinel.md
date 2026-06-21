# Sentinel Security Journal

## 2025-05-23 - MFA Authentication Bypass Fix
**Vulnerability:** The 2FA verification endpoint (`/auth/verify-2fa`) accepted a raw `userId` to identify the user, without any proof that the user had successfully passed the first stage of authentication (password check). This allowed an attacker with a user's ID and a valid TOTP code to bypass the password requirement.

**Learning:** multi-step authentication flows must securely link the stages. Relying on client-provided identifiers like `userId` in subsequent steps without server-side verification of the previous step's success is a common bypass pattern.

**Prevention:** Use short-lived, signed, and purpose-bound tokens (e.g., `mfaToken`) issued upon successful completion of the first step. The token should contain the user's identity and any necessary context (like `hotelId`), and its validity must be verified in the subsequent step.
