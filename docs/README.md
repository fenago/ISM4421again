# Hacker News Tech-News App — Research Docs

Research on the [Hacker News API](https://github.com/HackerNews/API) for building an app that keeps you up to date on tech news.
These docs are the **shared context for the expert agent team** that will design and build the app. Read this index first, then the files relevant to your role.

_Research date: 2026-11-23. Live endpoints were spot-checked on that date (see [10-sources.md](10-sources.md))._

## TL;DR

- The official API is a **read-only, unauthenticated, JSON-over-HTTPS** mirror of HN data hosted on Firebase at `https://hacker-news.firebaseio.com/v0/`. No API key, no documented rate limit.
- It is a **"dump of in-memory data structures"**: list endpoints return only **IDs**, so every story/comment must be fetched individually (the N+1 problem). Plan for concurrency + caching from day one.
- **Real-time** updates are available via Firebase SDKs or plain **Server-Sent Events** (`Accept: text/event-stream`) on any endpoint — no polling required.
- There is **no search, no filtering, no sorting by topic** in the official API. For keyword/topic search and date-range queries, pair it with the **Algolia HN Search API** (`hn.algolia.com/api/v1`, 10,000 req/hour/IP).
- It's **read-only**: no login, voting, commenting or submitting via API.

## Documents

| # | File | What's in it | Primary audience |
|---|------|--------------|------------------|
| 01 | [01-overview.md](01-overview.md) | What the API is, base URL, versioning, auth, limits, design philosophy | Everyone |
| 02 | [02-endpoints.md](02-endpoints.md) | Complete endpoint reference with examples | Backend / data agents |
| 03 | [03-data-model.md](03-data-model.md) | Item & user schemas, item types, field-by-field notes, TypeScript types | Backend / frontend agents |
| 04 | [04-realtime-updates.md](04-realtime-updates.md) | SSE streaming, Firebase SDK listeners, `/updates`, polling strategy | Backend / realtime agents |
| 05 | [05-fetching-patterns.md](05-fetching-patterns.md) | N+1 fan-out, concurrency, caching, pagination, comment trees | Backend / performance agents |
| 06 | [06-algolia-search-api.md](06-algolia-search-api.md) | Complementary HN Search API (full-text, tags, date filters) | Search / data agents |
| 07 | [07-gotchas-and-edge-cases.md](07-gotchas-and-edge-cases.md) | Nulls, deleted/dead items, HTML in text, missing fields, quirks | Everyone (QA especially) |
| 08 | [08-app-architecture.md](08-app-architecture.md) | Recommended architecture, features, "tech news" filtering, stack options | Architect / product agents |
| 09 | [09-agent-team-briefing.md](09-agent-team-briefing.md) | Proposed agent roles, conventions, open decisions, acceptance criteria | Orchestrator / all agents |
| 10 | [10-sources.md](10-sources.md) | Sources and live verification log | Everyone |

## Quick start (copy-paste)

```bash
curl "https://hacker-news.firebaseio.com/v0/topstories.json"
```

```bash
curl "https://hacker-news.firebaseio.com/v0/item/8863.json?print=pretty"
```

```bash
curl -N -H "Accept: text/event-stream" "https://hacker-news.firebaseio.com/v0/topstories.json"
```

```bash
curl "https://hn.algolia.com/api/v1/search_by_date?query=rust&tags=story"
```
