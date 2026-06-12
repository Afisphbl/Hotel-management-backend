## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The `verify-2fa` endpoint was using a raw `userId` to identify the user completing the second factor of authentication. This allowed an attacker who knew a user's ID to skip the password check and go straight to the 2FA prompt.
**Learning:** Multi-step authentication flows must be cryptographically linked. Providing a raw ID after a successful first factor is insufficient if the second factor endpoint doesn't verify that the first factor was actually completed.
**Prevention:** Use short-lived, signed, and purpose-bound tokens (e.g., an `mfaToken` signed with a secret) to pass state between authentication steps.

## 2025-05-23 - Missing Password Complexity Enforcement
**Vulnerability:** Several services were performing password changes or user creation without calling the `PasswordPolicyService.assertCompliant` method, leading to inconsistent enforcement of security policies.
**Learning:** Centralized security policies (like password complexity) must be explicitly invoked at every entry point where sensitive data is modified.
**Prevention:** Integrate policy checks into the service layer for all password-related operations and consider using a global interceptor or decorator if possible.
