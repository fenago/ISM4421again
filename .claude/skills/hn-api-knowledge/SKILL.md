---
name: hn-api-knowledge
description: Provides authoritative knowledge of the official Hacker News Firebase API (hacker-news.firebaseio.com/v0) - endpoints, item/user schemas, item-type classification and every known quirk (null items, dead/deleted, HTML fields, Unix seconds, jobs in topstories). Use when building or reviewing the HN client, mapping raw items to the Story model, writing acceptance criteria or tests about feeds, or answering "what does the HN API return for X".
metadata:
  id: S01
  used-by: [product-owner, tech-news-editor, hn-community-expert, solution-architect, hn-api-integration-engineer, frontend-engineer, search-discovery-engineer, data-engineer, ai-ml-engineer, qa-test-engineer, expert-orchestrator]
  mvp: true
---
# HN API Knowledge

## Purpose
One shared, correct mental model of the official HN API so no agent re-discovers its quirks the hard way. Sources: [01-overview](../../../docs/01-overview.md), [02-endpoints](../../../docs/02-endpoints.md), [03-data-model](../../../docs/03-data-model.md), [07-gotchas](../../../docs/07-gotchas-and-edge-cases.md).

## When to use
- Writing or reviewing anything in `src/lib/hn/` (types, client, normalizer).
- Deciding which endpoint feeds a tab, or whether a feature is even possible (no search, no writes).
- Writing stories, test cases or fixtures that involve HN data.

## Core facts
| Property | Value |
|---|---|
| Base URL | `https://hacker-news.firebaseio.com/v0/` - every path **must end in `.json`** (otherwise you get an HTML redirect) |
| Auth / writes | None / none. Read-only: no login, vote, comment, submit |
| Rate limit | None documented. Be polite: cache so traffic scales with *change*, not users |
| Versioning | Only `v0`. **Ignore unknown fields** - new ones can appear any time |
| Scale (2026-11-23) | Item IDs ~50.6M; a hot story had `descendants: 2384`, ~500 top-level kids |

## Endpoints
| Endpoint | Returns | Cap | Notes |
|---|---|---|---|
| `/item/{id}.json` | item or `null` | - | Core building block, one request per item (no batch endpoint) |
| `/user/{id}.json` | user or `null` | - | Username **case-sensitive** |
| `/maxitem.json` | int | - | Walk backward for firehose ingestion (rarely needed) |
| `/topstories.json` | `int[]` | 500 | **Includes jobs** |
| `/newstories.json` | `int[]` | 500 | |
| `/beststories.json` | `int[]` | varies | Check length at runtime |
| `/askstories.json`, `/showstories.json`, `/jobstories.json` | `int[]` | 200 | |
| `/updates.json` | `{items:int[], profiles:string[]}` | small | Change feed for cache invalidation |

Lists are ordered by rank (index 0 = #1). Useful Firebase params: `print=pretty` (debug), `shallow=true`, `orderBy="$key"&limitToFirst=N` (returns an **object keyed by index**, unverified - prefer `ids.slice(0, 30)`; the whole list is ~5 KB). Any endpoint can stream via `Accept: text/event-stream` (see `realtime-streaming-sse`).

**Does not exist:** search, date-range queries, batch fetch, comment scores, "past front page", user upvotes, any auth. Use Algolia (`algolia-hn-search`) for search/history.

## Data model
Only `id` is guaranteed. Every other field may be **absent** (not `null`).

| Field | Type | Notes |
|---|---|---|
| `type` | `"story"\|"comment"\|"job"\|"poll"\|"pollopt"` | |
| `by`, `time` | string, int | `time` is **Unix seconds** (`* 1000` for JS `Date`) |
| `title`, `text` | HTML strings | Entities like `&#x27;`; `text` uses `<p>` as separators |
| `url` | string | Absent for Ask HN; may be `""` for jobs (treat as missing) |
| `score`, `descendants` | int | `descendants` = whole-tree comment count |
| `kids` | int[] | Direct children in **ranked display order** - preserve it |
| `parent`, `poll`, `parts` | int / int / int[] | comment parent, pollopt's poll, poll options |
| `deleted`, `dead` | bool | Deleted keeps almost nothing; dead = flagged/killed |

Classify `type: "story"` by title prefix: `Ask HN:` -> ask, `Show HN:` -> show, `Launch HN:` -> launch, `Tell HN:` -> tell, else link. `url` and `text` are **not** mutually exclusive (observed 2026-11-23).

## Canonical types and normalizer
Raw types live in `src/lib/hn/types.ts` (copy from [03](../../../docs/03-data-model.md)); UI code only sees `Story`.

```ts
export function classify(item: HNItem): Story["kind"] {
  if (item.type === "job") return "job";
  if (item.type === "poll") return "poll";
  const t = item.title ?? "";
  if (/^Ask HN:/i.test(t)) return "ask";
  if (/^Show HN:/i.test(t)) return "show";
  if (/^Launch HN:/i.test(t)) return "launch";
  if (/^Tell HN:/i.test(t)) return "tell";
  return "link";
}

export function toStory(item: HNItem, rank?: number): Story | null {
  if (item.deleted || item.dead || !item.title) return null;
  const url = item.url?.trim() || undefined;          // "" -> undefined
  let domain: string | undefined;
  if (url) { try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* bad url */ } }
  return {
    id: item.id, kind: classify(item),
    title: decodeEntities(item.title),                // see html-sanitization-web-security
    url, domain,
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    author: item.by, points: item.score ?? 0, comments: item.descendants ?? 0,
    createdAt: new Date((item.time ?? 0) * 1000),
    textHtml: item.text ? sanitizeHnHtml(item.text) : undefined,
    rank, fetchedAt: new Date(),
  };
}
```

## Quirk checklist (each needs a test - see `software-testing`)
- [ ] `null` body with HTTP 200 for missing item/user is handled.
- [ ] Missing `score`/`descendants`/`kids`/`by`/`title` don't crash; defaults are 0 / [].
- [ ] `deleted`/`dead` filtered from feeds, then **backfilled** to keep 30 per page.
- [ ] In comment trees, dead/deleted nodes render as `[deleted]`/`[dead]` placeholders if they have children.
- [ ] Jobs in `/topstories` are labeled (or filtered) - decision recorded in an ADR.
- [ ] `url === ""` treated as no URL; non-http(s) URLs rejected.
- [ ] Times converted from seconds exactly once, at normalization.
- [ ] Titles entity-decoded for plain text; HTML fields sanitized before render.
- [ ] Unknown fields ignored (no strict schema that rejects extra keys).
- [ ] Scores/titles treated as mutable for ~48 h (moderators edit titles).
- [ ] Usernames never lowercased.

## Netlify notes
- Users never fan out to HN: the Scheduled Function pre-builds feeds into Netlify Blobs (`netlify-platform`, `caching-performance`).
- The browser may open `EventSource` directly to `hacker-news.firebaseio.com` for live list changes.
- The dev sandbox gets **403** from its proxy for `hacker-news.firebaseio.com` - use recorded fixtures, not live calls.

## Attribution / etiquette
Always link both the original URL and `https://news.ycombinator.com/item?id={id}`. Do not imply YC affiliation.

## Used by
product-owner, tech-news-editor, hn-community-expert, solution-architect, hn-api-integration-engineer, frontend-engineer, search-discovery-engineer, data-engineer, ai-ml-engineer, qa-test-engineer, expert-orchestrator
