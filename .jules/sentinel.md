## 2025-05-15 - [MFA Token Pattern]
**Vulnerability:** The 2FA flow previously returned a raw `userId` upon successful password verification, which was then used as-is in the `verify-2fa` endpoint. This could allow an attacker to attempt 2FA brute-forcing for any known user ID without having the user's password.
**Learning:** Returning internal identifiers as session state for multi-step authentication flows is insecure as it lacks proof of previous successful steps.
**Prevention:** Use short-lived, signed, and purpose-bound tokens (e.g., `mfaToken` with `purpose: 'mfa_verification'`) to securely link authentication stages.

## 2025-05-15 - [JwtModule Configuration]
**Vulnerability:** `JwtModule` was configured using `sortOptions` instead of `signOptions` for `expiresIn`, which is a common typo that leads to the underlying library ignoring the expiration setting, resulting in non-expiring tokens.
**Learning:** Standard library configurations must be carefully audited for typos that might lead to silent security failures.
**Prevention:** Always verify that security-relevant configurations like token expiration are correctly applied by inspecting the generated tokens or via unit tests.
