## 2025-05-23 - MFA Authentication Bypass
**Vulnerability:** The `verify-2fa` endpoint allowed authentication completion using only a raw `userId` or `tempToken` without ensuring the user had successfully passed the first authentication factor (password) in the same session. This allowed potential attackers to bypass the first factor if they obtained a user ID.
**Learning:** Returning raw database IDs or unsigned tokens as "pointers" to an authentication state is insecure. It creates a disconnected flow that can be manipulated.
**Prevention:** Use signed, short-lived tokens (MFA tokens) to securely link authentication stages. The token should contain necessary claims (like `sub` and `hotelId`) and a specific type claim to prevent token reuse across different flows.
