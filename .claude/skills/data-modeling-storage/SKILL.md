---
name: data-modeling-storage
description: Chooses and designs storage for the HN tech-news app on Netlify, covering Netlify Blobs feed caches, Postgres/Supabase schemas for stories and score snapshots, migrations and retention. Use when asked "where should we store feeds", "Blobs or Supabase?", "design the schema", "store history for digests/velocity", "write a migration", or to plan data retention and user-data tables.
metadata:
  id: S19
  used-by: [solution-architect, hn-api-integration-engineer, data-engineer, ai-ml-engineer]
  mvp: false
---
# Data Modeling & Storage

## Purpose
Pick the simplest storage that meets each feature's needs, starting with a Blobs feed cache for MVP and adding a relational store only when history, digests, velocity or accounts require it.

## When to use
- Storage decisions (write an ADR), schema design, migrations, retention policies.
- Adding features that need history (velocity, digests, trends) or per-user data.

## Decision framework
| Need | Choose | Why |
|---|---|---|
| MVP feed cache (current Top/New/Best/Ask/Show/Jobs pages, normalized) | **Netlify Blobs** (key-value, site-scoped) | Zero extra vendor; written by a Scheduled Function, read by a Function or edge |
| Story history, score snapshots, topic tags, digests | **Postgres** (Supabase or Neon) | Time-series-ish queries, joins, SQL aggregates |
| User accounts, saved topics, email subscriptions | Postgres with row-level security (Supabase Auth) | Auth + RLS; personal data → privacy review |
| Search | Algolia HN API (proxied + cached), not our DB | Already indexed; no need to replicate |
| Client prefs without accounts | `localStorage` | No personal data server-side |
Rule: don't add Postgres until a V2 epic needs it. Document the choice in an ADR (architecture-decision-records).

## Blobs layout (MVP)
```
store "feeds":
  feeds/top.json      -> { generatedAt, ids:[...500], items:[Story x first 90] }
  feeds/new.json, feeds/best.json, feeds/ask.json, feeds/show.json, feeds/job.json
store "items":
  item/{id}.json      -> normalized Story, TTL handled by generatedAt check
store "search-cache":
  q/{sha1(query+params)}.json -> { fetchedAt, hits }   (TTL 2–10 min)
```
- Writes: Scheduled Function every 1–5 min (docs/expert-roster). Write a whole feed object atomically; readers never see half a list.
- Include `schemaVersion` in every blob; readers must tolerate older versions during deploys.

## Relational schema (V2) — extends docs/08
```sql
CREATE TABLE stories (
  id BIGINT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, url TEXT, domain TEXT,
  author TEXT, created_at TIMESTAMPTZ NOT NULL, score INT NOT NULL DEFAULT 0,
  comments INT NOT NULL DEFAULT 0, dead BOOLEAN DEFAULT FALSE, deleted BOOLEAN DEFAULT FALSE,
  topics TEXT[] DEFAULT '{}', topics_version INT, first_seen_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL);
CREATE INDEX ON stories (created_at DESC);
CREATE INDEX ON stories USING GIN (topics);
CREATE TABLE story_snapshots (
  story_id BIGINT REFERENCES stories(id) ON DELETE CASCADE, at TIMESTAMPTZ NOT NULL,
  score INT, comments INT, rank INT, list TEXT, PRIMARY KEY (story_id, at, list));
CREATE TABLE feed_positions (list TEXT, rank INT, story_id BIGINT, PRIMARY KEY (list, rank));
-- only if accounts exist:
CREATE TABLE user_topics (user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  topic TEXT, PRIMARY KEY (user_id, topic));
CREATE TABLE digest_subscriptions (user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL, cadence TEXT CHECK (cadence IN ('daily','weekly')),
  consent_at TIMESTAMPTZ NOT NULL, unsubscribed_at TIMESTAMPTZ);
```
Conventions: times UTC (convert Unix seconds once, docs/09); HN `id` is the PK (globally unique, increasing); upsert on `id`; never store raw unsanitized HTML for render.

## Snapshot sizing & retention
- Snapshot only stories in top 90 of any list, every 5 min, for 48 h after `created_at` (scores settle after that, docs/07).
- Rough volume: ~200 active stories × 12/hr × 48 h ≈ 115k rows per day-cohort; downsample to hourly after 48 h, delete raw after 30 days.
- User data: delete on account deletion (`ON DELETE CASCADE`); unsubscribed digest rows purged after 30 days (confirm with privacy-data-protection).

## Migration procedure
1. Write forward-only SQL migration in `db/migrations/NNNN_description.sql` (Supabase CLI or plain SQL runner).
2. Additive first (new nullable column), backfill, then enforce constraints in a later migration.
3. Run against a branch/preview database on the PR's deploy preview; never against prod from a laptop.
4. Update TypeScript types (`src/db/types.ts`) in the same PR.
5. Secrets (DB URL, service key) only in Netlify env vars, scoped to Functions; never `VITE_`/`NEXT_PUBLIC_`.

## Pitfalls
- Storing per-user copies of HN data (store once, reference by id).
- Treating cached scores as final within 48 h.
- Writing Blobs from client code or exposing service-role keys to the browser.
- Unbounded snapshot tables → cost surprises (check finops-cost-modeling).
- Forgetting `null` items/deleted stories when upserting.

## Used by
- solution-architect
- hn-api-integration-engineer
- data-engineer
- ai-ml-engineer
