## 2025-05-15 - [MFA Flow Security]
**Vulnerability:** Multi-step authentication flows (like 2FA) often leak user identifiers (like userId) in the intermediate response, and the second step might not properly verify that the user successfully passed the first step (password check).
**Learning:** Returning a raw userId to the client and then using it in a subsequent request is insecure. It exposes internal identifiers and can be bypassed if the server doesn't maintain state or use signed tokens to link the steps.
**Prevention:** Always use short-lived, signed, purpose-bound tokens (e.g., an `mfaToken`) to transition between authentication stages. The token should be signed by the server and include a 'purpose' claim to prevent it from being used for other actions.
