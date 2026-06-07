## 2025-05-15 - [Missing Password Complexity Enforcement]
**Vulnerability:** Weak passwords could be set during user creation, profile updates (change password), and staff management.
**Learning:** Even with a `PasswordPolicyService` available, it wasn't consistently applied across all authentication and user/staff management services, leading to potential security gaps where weak passwords could be used.
**Prevention:** Always use `PasswordPolicyService.assertCompliant()` in any service method that handles password creation or updates before hashing and saving to the database.
