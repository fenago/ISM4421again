# 08 — Recommended App Architecture

Goal: **an app that gives Dr. Lee continuously updated tech news from Hacker News**, ideally filtered to what matters, with minimal noise.

## Core features (MVP → later)

**MVP**
1. Feeds: Top, New, Best, Ask, Show, Jobs (tabs), 30 per page, with rank, title, domain, points, comment count, age, author.
2. Live updates: new stories and score changes appear without a manual refresh ("3 new stories" pill).
3. Story detail: open link + HN discussion; lazy-loaded comment tree with sanitized HTML.
4. Keyword search (Algolia).

**V2**
5. **Topic filters / watchlists** (e.g. AI, security, Rust, startups): keyword rules on title + domain, optionally Algolia-backed topic feeds.
6. **Signal threshold**: only show stories above X points or Y comments, or "velocity" (points/hour).
7. **Digests**: daily/weekly "what you missed" email or push, ranked by peak score. Requires storing history.
8. Read/unread state, bookmarks, hide domains.
9. Optional AI summaries of linked article + discussion (LLM layer; out of scope for the HN API itself).

## Architecture (recommended)

```
             ┌─────────────────────────── Backend ───────────────────────────┐
HN Firebase ─┤ Ingestor (SSE: top/new/best/ask/show/job + /updates)          │
 (SSE/REST)  │   → fetch new/changed items (bounded concurrency, retries)     │
             │   → normalize (Story model, decode, sanitize, classify)        │
Algolia ─────┤ Search proxy (cached, rate-limit aware)                        │
             │ Store: Redis/KV (hot cache) + Postgres/SQLite (history)        │
             │ App API: GET /feeds/:name?page, /stories/:id, /search, /stream │
             └────────────────────────────────┬──────────────────────────────┘
                                              │ REST + SSE/WebSocket
                                   ┌──────────┴──────────┐
                                   │ Client (web/PWA/mobile) │
                                   └─────────────────────┘
```

Why a backend instead of calling HN directly from the client:
- One fan-out to HN serves all users (cache). Clients make **1** request per page instead of 31.
- Normalization, sanitization and topic classification happen once.
- History enables digests, velocity ranking and "trending in topic".
- Hides Algolia rate limits behind a cache.

A **client-only** version (static site calling Firebase + Algolia directly from the browser) is a valid **prototype**: zero infra, real-time via `EventSource`. Expect slower first paint due to N+1.

## Stack options

| Option | Fit |
|---|---|
| **Next.js (React) + Node route handlers + SQLite/Postgres + Redis** | Full-stack TS, SSR for fast first paint, easy deploy (Vercel/Fly/Render). Default recommendation |
| SvelteKit / Remix | Equivalent alternatives |
| Python FastAPI ingestor + any frontend | Good if team prefers Python for data/AI summaries |
| React Native / Expo | If a native mobile app is required; reuse the same backend API |
| Supabase (Postgres + Realtime + Edge Functions) | Managed DB + realtime fan-out to clients; ingestor as scheduled edge function or small worker |

Note: always-on SSE ingestion needs a long-lived process (container/VM/worker). Pure serverless should use **cron polling** (every 1 min) instead.

## Data storage sketch

```sql
CREATE TABLE stories (
  id            BIGINT PRIMARY KEY,
  kind          TEXT NOT NULL,          -- link|ask|show|launch|tell|job|poll
  title         TEXT NOT NULL,
  url           TEXT,
  domain        TEXT,
  author        TEXT,
  created_at    TIMESTAMPTZ NOT NULL,
  score         INT NOT NULL DEFAULT 0,
  comments      INT NOT NULL DEFAULT 0,
  dead          BOOLEAN DEFAULT FALSE,
  deleted       BOOLEAN DEFAULT FALSE,
  topics        TEXT[] DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL
);
CREATE TABLE story_snapshots (            -- for velocity/trending + digests
  story_id BIGINT REFERENCES stories(id),
  at       TIMESTAMPTZ NOT NULL,
  score    INT, comments INT, rank INT, list TEXT,
  PRIMARY KEY (story_id, at, list)
);
CREATE TABLE feed_positions (             -- current ranking per list
  list TEXT, rank INT, story_id BIGINT, PRIMARY KEY (list, rank)
);
```

## Topic classification ("tech news" filtering)

Simple, deterministic first:
- Keyword/regex rules over decoded title (e.g. `\b(LLM|GPT|Claude|transformer|AI)\b` → `ai`).
- Domain rules (e.g. `arxiv.org` → `research`, `github.com` → `open-source`).
- Later: embedding or LLM classifier on title + first paragraph, with rules as fallback.

## Ranking ideas
- HN's own order for Top (source of truth).
- "Velocity": Δscore / Δtime from snapshots, which surfaces rising stories before they peak.
- Personal: boost watched topics, demote hidden domains.

## Non-functional targets
- Feed API p95 < 200 ms from cache. New top story visible in client < 60 s after HN.
- Ingestor resilient to stream drops (auto-reconnect, polling fallback).
- All rendered HTML sanitized. No secrets needed for HN/Algolia.
- Accessibility: keyboard navigation, readable dark/light themes.
