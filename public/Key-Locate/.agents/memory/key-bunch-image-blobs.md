---
name: Key-bunch base64 blobs in list responses
description: Why key/history list endpoints must never return imageUrl/documentUrl blobs
---
Key photos and documents are stored as base64 data URLs directly in `key_bunches.image_url` / `document_url` (some rows are 250KB+ each; ~180MB total for one company).

**Rule:** any query that returns multiple key bunches (lists, history joins, audits) must exclude `imageUrl`/`documentUrl` and expose `hasImage`/`hasDocument` flags instead. Only the single-key endpoint (`/api/key-bunches/:id`) returns the full row — the detail page fetches images from there.

**Why:** returning full rows made `/api/keys/list` respond with 188 MB in 10–23s and risked the 32 MiB autoscale gateway limit; this was reported as "the live site is very slow" (July 2026).

**How to apply:** use `keyBunchListColumnsSet()` in `server/storage.ts` for any new list-style key-bunch query; backfill `imageUrl: null, documentUrl: null` to keep the `KeyBunch` type contract. A longer-term improvement would be moving images to object storage and serving URLs.
