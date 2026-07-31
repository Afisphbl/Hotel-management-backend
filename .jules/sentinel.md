## 2025-05-15 - [2FA Token Pattern]
**Vulnerability:** The 2FA verification endpoint relied on a client-provided `userId` or `tempToken` (which was just the `userId` in practice) without verifying an active, authenticated session.
**Learning:** Returning raw user identifiers during multi-step authentication allows for potential factor bypass or brute-forcing if the second step isn't cryptographically bound to the first.
**Prevention:** Use short-lived, signed, purpose-bound tokens (e.g., JWT with `mfa_verification` claim) to transition between authentication steps.
