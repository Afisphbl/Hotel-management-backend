## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA verification flow was vulnerable to authentication bypass and brute-force attacks. The `verify-2fa` endpoint accepted a raw `userId`, allowing an attacker to bypass the first factor (password) and directly attempt to guess the 2FA code for any user. Additionally, failed MFA attempts were not being recorded as failed logins, facilitating brute-force attacks on the second factor.

**Learning:** Returning a raw user identifier as a "temporary token" after successful password verification creates a security gap where the second factor can be independently targeted without proof of the first factor's success.

**Prevention:** Always use signed, short-lived tokens (e.g., JWT) to link multi-stage authentication processes. These tokens should contain necessary context (like user ID and login intent) and be verified at each subsequent step. Ensure that failures in any authentication factor contribute to account lockout and brute-force protection mechanisms.
