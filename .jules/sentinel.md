## 2025-05-14 - Insecure 2FA Token Pattern
**Vulnerability:** The 2FA verification flow previously relied on an insecure pattern where a plain `userId` was returned in the initial login response and accepted by the `verify-2fa` endpoint.
**Learning:** Returning or accepting a plain `userId` for multi-step authentication allows for potential factor bypass or user enumeration if not properly bound to the session.
**Prevention:** Multi-step authentication flows should use short-lived, signed, and purpose-bound tokens (e.g., `mfaToken` with a `mfa_verification` claim) to securely transition between stages.
