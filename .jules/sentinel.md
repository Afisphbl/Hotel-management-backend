## 2025-05-23 - Missing Password Complexity Enforcement
**Vulnerability:** Several user creation and password change flows were missing enforcement of the defined password policy, allowing weak passwords.
**Learning:** While a `PasswordPolicyService` existed, it was only being used in `PlatformService`, leaving `AuthService`, `StaffService`, `PublicService`, and `UserManagementService` vulnerable.
**Prevention:** Always integrate the centralized `PasswordPolicyService.assertCompliant` whenever hashing a new password. Ensure the service is correctly provided in the corresponding modules.
