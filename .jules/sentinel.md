## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA flow was using an insecure, unauthenticated `userId` to identify users in the second stage of authentication (`verify-2fa`). This allowed an attacker to bypass the first stage (password verification) and attempt to brute-force 2FA codes for any user if they knew their UUID.
**Learning:** In multi-step authentication flows, the transition between steps must be secured by a signed, short-lived token (like a JWT) that binds the session to the user who successfully completed the previous step.
**Prevention:** Use purpose-bound MFA tokens (e.g., with a `type: 'mfa'` claim) instead of raw user identifiers to link authentication stages. Ensure these tokens have a very short expiration (e.g., 5 minutes).
