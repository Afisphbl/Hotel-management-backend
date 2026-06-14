# Sentinel Security Journal

## 2025-05-15 - [Insecure 2FA Token Pattern]
**Vulnerability:** The 2FA flow was using a raw `userId` to transition from password verification to 2FA verification, allowing anyone with a `userId` to potentially bypass the first factor or attempt to brute-force the second factor for any user.
**Learning:** Transitioning between multi-step authentication stages requires a secure, short-lived, and purpose-bound token to cryptographically link the stages.
**Prevention:** Always use signed, short-lived tokens (e.g., JWT with a `purpose` claim) when moving between authentication factors.
