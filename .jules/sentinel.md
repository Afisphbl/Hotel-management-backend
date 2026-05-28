## 2025-05-22 - [MFA Token Bypass Fix]
**Vulnerability:** The 2FA flow accepted a raw `userId` from the client after password validation, allowing an attacker to bypass the second factor or impersonate other users if they could find a way to skip the first stage or exploit the `verify-2fa` endpoint.
**Learning:** Returning internal identifiers like `userId` as a "continuation token" for multi-step authentication is insecure.
**Prevention:** Use short-lived, signed, and purpose-bound tokens (e.g., JWT with a `purpose: mfa` claim) to securely link authentication steps.
