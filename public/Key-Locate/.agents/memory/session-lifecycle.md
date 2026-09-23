---
name: Session lifecycle
description: Authentication session expiry and scheduled cleanup behavior
---
- Authentication sessions use a 24-hour PostgreSQL-backed cookie/session TTL. Do not add a timed global DELETE from the sessions table as a routine security measure.
**Why:** A twice-daily global purge logged every active user out at fixed times, causing otherwise valid create requests to return 401 until the user logged in again.
**How to apply:** If forced logout is ever required, use an explicit admin/security action with user-facing handling rather than a scheduled purge that interrupts active work.