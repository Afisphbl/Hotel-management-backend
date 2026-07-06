## 2025-05-24 - Timing Attack Mitigation in Webhook Verification
**Vulnerability:** Use of insecure string comparison (===) for HMAC signature verification in ChapaService.
**Learning:** Standard string comparison in JavaScript is not constant-time and can leak information about the signature through timing differences, potentially allowing an attacker to forge valid webhook payloads.
**Prevention:** Always use `crypto.timingSafeEqual` with Buffers of equal length for comparing cryptographic hashes or signatures.
