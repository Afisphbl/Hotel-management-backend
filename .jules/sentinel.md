## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA verification endpoint (`/auth/verify-2fa`) previously accepted a raw `userId` or `tempToken` to identify the user completing 2FA.
**Learning:** This allowed an attacker with knowledge of a user's ID to attempt 2FA code verification without having successfully passed the first stage of authentication (password verification).
**Prevention:** Always use a signed, short-lived, purpose-bound token (like a JWT with a `type: 'mfa'` claim) to link multiple stages of an authentication flow. This ensures the second stage cannot be initiated without a valid first-stage proof.
