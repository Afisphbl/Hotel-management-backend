## 2025-05-24 - MFA Authentication Bypass and Brute-force Risk
**Vulnerability:** The `verify-2fa` endpoint relied on a client-provided `userId`, allowing attackers to attempt 2FA codes for any user. Additionally, failed MFA attempts were not being recorded, facilitating brute-force attacks.
**Learning:** MFA flows must be securely linked to the initial authentication step using a signed, short-lived token (e.g., `mfaToken`) to prevent session swapping or IDOR.
**Prevention:** Always use signed tokens for multi-step authentication processes and ensure all authentication factors are subject to rate limiting and account lockout policies.
