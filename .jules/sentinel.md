## 2025-05-24 - MFA Authentication Bypass and Brute-force Risk
**Vulnerability:** The 2FA verification endpoint (`/auth/verify-2fa`) accepted a raw `userId`, allowing attackers to bypass the first factor if they knew a user's ID and could brute-force the 6-digit TOTP code. Additionally, failed 2FA attempts were not recorded, making brute-force attacks easier.
**Learning:** Initial authentication steps should return a secure, signed, and short-lived token (intent token) to link multi-step processes like MFA, rather than relying on client-provided identifiers.
**Prevention:** Always use signed tokens (e.g., JWT with specific claims) to transition between authentication phases. Ensure all authentication-related inputs are subject to rate limiting and account lockout policies.
