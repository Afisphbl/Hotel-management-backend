# Sentinel Security Journal

## 2025-05-15 - Missing Password Complexity Enforcement
**Vulnerability:** Password complexity was not enforced across multiple user and staff management services, despite a `PasswordPolicyService` existing in the codebase.
**Learning:** Foundational security services like password policies must be consistently applied at all entry points (creation, update, registration) to be effective. Relying on frontend validation or only partial backend enforcement creates gaps.
**Prevention:** Always identify all methods where sensitive data like passwords are set and ensure they call a centralized validation service. Add `PasswordPolicyService` to the relevant modules and inject it into the services.
