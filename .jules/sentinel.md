## 2025-05-23 - Missing Password Complexity Enforcement
**Vulnerability:** Critical user-facing services (AuthService, UserManagementService, PublicService, StaffService) were found to be missing password complexity enforcement during registration and password change operations.
**Learning:** While a `PasswordPolicyService` was available, it was inconsistently applied, leading to a situation where weak passwords could be set in multiple parts of the system.
**Prevention:** Ensure that any service handling password creation or modification injects and utilizes `PasswordPolicyService.assertCompliant()` before hashing and persisting passwords.
