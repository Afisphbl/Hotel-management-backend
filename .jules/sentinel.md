## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA flow previously relied on a client-provided `userId` for the second factor verification step, allowing a potential bypass or session hijacking if an attacker could guess or obtain a valid user ID after a password compromise.
**Learning:** Initial "illustrative" implementations of multi-step authentication often leave gaps in state transition security.
**Prevention:** Always use signed, short-lived, purpose-bound tokens (like the `mfaToken` implemented here) to cryptographically link authentication stages.
