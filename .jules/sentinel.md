## 2025-05-20 - [Short-lived MFA Session Tokens]
**Vulnerability:** The login process returned a raw `userId` when 2FA was required. An attacker knowing a user's ID could potentially attempt to brute-force the 2FA code on the `/verify-2fa` endpoint without having successfully passed the password check.
**Learning:** Returning internal identifiers as session placeholders for multi-step authentication allows attackers to bypass the first factor of authentication for brute-forcing subsequent factors.
**Prevention:** Use a short-lived, signed, and purpose-bound token (e.g., an MFA session token) to bridge the gap between authentication factors.
