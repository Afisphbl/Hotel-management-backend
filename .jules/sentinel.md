## 2025-05-15 - [Secure 2FA Multi-step Flow]
**Vulnerability:** Insecure login transition where only `userId` was required for 2FA verification, allowing potential factor bypass or brute-force on the second factor.
**Learning:** Returning internal identifiers like `userId` between authentication steps creates a weak link that can be exploited if the second factor has its own vulnerabilities (e.g. weak codes, rate limiting issues).
**Prevention:** Always use short-lived, cryptographically signed, and purpose-bound tokens (e.g., `mfaToken`) to securely link authentication steps.
