## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The MFA verification endpoint accepted a raw user ID, allowing attackers to bypass the first factor of authentication (password) if they knew a user's ID, or to brute-force 2FA codes for any user without successfully logging in first.
**Learning:** Two-stage authentication must be cryptographically linked. Issuing a short-lived, signed token (e.g., mfaToken) upon successful password verification ensures that the second stage can only be initiated by someone who has already passed the first.
**Prevention:** Use signed tokens to maintain state between authentication phases. Always record failed attempts on the second factor to mitigate brute-force attacks.
