# 01 — Overview of the Hacker News API

## What it is

Hacker News (news.ycombinator.com, run by Y Combinator) publishes its public data through Firebase "in near real time". The official docs live at <https://github.com/HackerNews/API>. Bug reports go to `api@ycombinator.com`.

| Property | Value |
|---|---|
| Base URL | `https://hacker-news.firebaseio.com/v0/` |
| Protocol | HTTPS, JSON. Every REST path must end in `.json` |
| Auth | None. Fully public, read-only |
| Rate limit | "There is currently no rate limit" (official README). Be polite anyway; see [05](05-fetching-patterns.md) |
| Write access | None. Cannot log in, vote, comment, submit, or flag |
| Version | `v0` (the only version ever released) |
| Hosting | Firebase Realtime Database, so the Firebase REST semantics (query params, SSE streaming) apply |

## Versioning contract

From the README:

- URIs are prefixed with `/v0/`. Future versions may break compatibility.
- Only **removing a non-optional field** or **altering an existing field** counts as a breaking change.
- **Clients must ignore unknown fields.** New fields can appear at any time. Make parsers tolerant (no strict schemas that reject extra keys).

## Design philosophy (and why it matters to us)

The README is unusually candid:

> "The v0 API is essentially a dump of our in-memory data structures… It's not the ideal public API, but it's the one we could release in the time we had."

Consequences for our app:

1. **Lists contain IDs only.** `/topstories` returns up to 500 integers; you fetch each item separately.
2. **No aggregate counts beyond `descendants`.** To count or render comments you traverse the tree.
3. **No "newest page" endpoint for Ask/Show beyond the latest 200.** Older content requires walking backward from `maxitem` or using Algolia.
4. **No search or filtering.** Topic filtering ("only AI/security/Rust news") must be done client-side or via Algolia ([06](06-algolia-search-api.md)).

## Two ways to consume it

1. **Firebase client SDKs** (web, Android, iOS, server). The README recommends these: they handle networking efficiently and emit change events. Point the SDK at `databaseURL: "https://hacker-news.firebaseio.com"` and read refs under `v0/`.
2. **Plain REST** (`fetch`/`curl`) with optional **Server-Sent Events** streaming. Simplest, language-agnostic, no SDK dependency.

Both are covered in [04-realtime-updates.md](04-realtime-updates.md).

## Scale reference (observed 2026-11-23)

- Item IDs are around **50.6 million** (e.g. the #1 top story was item `50611576`).
- `/topstories` returned roughly 500 IDs.
- A single hot story had `descendants: 2384` and ~500 top-level `kids`, which shows how large one comment tree can be.
