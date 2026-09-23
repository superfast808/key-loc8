---
name: Brevo email sending
description: Gotchas for the Brevo transactional email setup (password resets)
---
- Brevo's API returns 2xx even for senders it later rejects — the app's "Sent reset email" log does NOT mean delivered. Verify via `GET /v3/smtp/statistics/events?email=...` (look for `delivered` vs `error`).
- Brevo only sends from verified senders (Settings → Senders & IPs). Current verified sender: hello@justsellmybusiness.com. Sends from unverified addresses (e.g. info@assured24.com) are silently rejected after acceptance.
- Sender address: `FROM_EMAIL` env var overrides `SENDGRID_FROM_EMAIL`.
- `/api/auth/forgot-password` always returns generic 200; failures only visible in server logs / Brevo events.
- Brevo "authorised IPs" restriction must stay disabled (dev/prod egress IPs differ and change).
**Why:** multiple rounds of "no email arrived" debugging traced to unverified senders while app logs claimed success.
**How to apply:** when reset emails "don't arrive", check Brevo events first, then sender verification, before touching code.
