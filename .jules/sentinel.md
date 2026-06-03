## 2025-05-15 - [MFA Token Transition]
**Vulnerability:** Use of raw `userId` for 2FA verification step.
**Learning:** Returning a raw `userId` after the first factor of authentication allows for potential factor bypass or brute-force attempts if the 2FA endpoint doesn't strictly validate that the user successfully passed the first factor recently.
**Prevention:** Use short-lived (e.g., 5 min), signed, purpose-bound tokens (MFA tokens) to securely transition between authentication factors. This binds the 2FA step to a successful password verification.
