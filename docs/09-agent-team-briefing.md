# 09 — Briefing for the Expert Agent Team

## Mission
Build an app that delivers **continuously updated tech news from Hacker News**, with live updates, search and topic filtering. Source of truth: the official HN Firebase API; search/history via Algolia.

## Proposed roles

| Agent | Owns | Must read |
|---|---|---|
| **Architect / Orchestrator** | Stack choice, interfaces between agents, final integration | 01, 08, this file |
| **Data/Ingestion engineer** | HN client, SSE/polling ingestor, retries, normalization, DB writes | 02, 03, 04, 05, 07 |
| **Search engineer** | Algolia proxy, topic feeds, caching under 10k/hr | 06, 07 |
| **Backend/API engineer** | App REST + realtime API, caching layers | 05, 08 |
| **Frontend engineer** | Feeds, story/comment views, live "new stories" UX, sanitization | 03, 07, 08 |
| **QA / Reliability** | Tests for edge cases in 07, contract tests against live API, load behavior | 07, 05 |
| **Product / UX** (optional) | Topic taxonomy, digests, ranking choices | 08 |

## Conventions (shared contract)
- Language: TypeScript end-to-end unless the Architect decides otherwise.
- Raw HN types live in one module (`hn/types.ts`, see [03](03-data-model.md)); UI uses only the normalized `Story`/`Comment` model.
- All HN/Algolia access goes through one client module with: base URL constants, timeout, retry with jittered backoff, bounded concurrency, `null` handling.
- Times stored as UTC timestamps (convert from Unix seconds once).
- HTML is sanitized at ingest and again (defense in depth) at render.
- Parsers tolerate unknown fields. Never fail on extra keys.
- Tests must not depend on live HN by default. Record fixtures (examples in [02](02-endpoints.md), [03](03-data-model.md)) and add an opt-in live smoke test.

## Open decisions for Dr. Lee / Architect
1. Platform: web/PWA only, or native mobile too?
2. Single-user personal app or multi-user (accounts, per-user topics)?
3. Hosting: always-on worker (SSE) vs serverless cron polling.
4. Which topics matter most (initial watchlist)?
5. Digests (email/push) in MVP or V2?
6. AI summaries: in scope? If so, which model/provider and budget.

## Definition of done (MVP)
- Top/New/Best/Ask/Show/Jobs feeds render 30 items/page in HN order, jobs labeled.
- New top stories appear in the client within 60 s without reload.
- Story view shows sanitized comment tree, lazy-loaded, handles deleted/dead.
- Keyword search works via Algolia, cached.
- Every edge case in [07](07-gotchas-and-edge-cases.md) has a test.
- README with run instructions; no secrets required.

## Known environment constraint
In the current cloud dev sandbox, direct requests to `hacker-news.firebaseio.com` are **blocked by the network proxy** (403). Live verification for this research was done through an external fetch service. Agents building/testing here will need that host (and `hn.algolia.com`) allow-listed in the environment, or must use fixtures.
