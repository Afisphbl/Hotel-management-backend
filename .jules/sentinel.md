## 2025-05-15 - Missing Password Complexity Enforcement
**Vulnerability:** Passwords were being accepted and hashed without any complexity validation in several key areas: user management, staff management (global and tenant), and guest registration.
**Learning:** While a `PasswordPolicyService` existed in the codebase, it was not consistently applied across all service layers. Developers were manually calling `bcrypt.hash` without first asserting compliance with the configured policy.
**Prevention:** Always inject `PasswordPolicyService` and call `assertCompliant` before hashing passwords in any service that handles user credentials. Centralizing this logic ensures that policy changes (e.g., minimum length) are automatically enforced everywhere.
