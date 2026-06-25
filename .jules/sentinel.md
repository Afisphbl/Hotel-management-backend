# Sentinel Security Journal

## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The 2FA flow was insecure as it exposed the internal 'userId' in the initial login response and allowed the second verification step to proceed using only that 'userId'. This enabled a partial authentication bypass where the login stages were not cryptographically linked.
**Learning:** Returning internal identifiers as transition state in multi-step authentication is a security risk. It allows attackers to attempt the next stage (e.g., 2FA) without necessarily having passed the first stage (e.g., password verification) for that specific user.
**Prevention:** Always use short-lived, signed, and purpose-bound tokens (like an 'mfaToken') to link authentication stages. These tokens should be verified for both signature and purpose (e.g., 'type: mfa') before allowing the next step.
