---
name: algolia-hn-search
description: Explains the Algolia HN Search API (hn.algolia.com/api/v1) - /search vs /search_by_date, tags, numericFilters, full comment trees via /items/{id}, field mapping to Firebase IDs, and the 10,000 req/hour/IP limit - and how to proxy it through a cached Netlify Function. Use when implementing keyword search, topic feeds, date/points filters, "past front page" history, single-call comment threads, or reviewing search rate-limit behaviour.
metadata:
  id: S02
  used-by: [solution-architect, hn-api-integration-engineer, search-discovery-engineer, data-engineer, qa-test-engineer]
  mvp: true
---
# Algolia HN Search

## Purpose
The official API has no search. Algolia's HN index fills the gap for search, topic feeds, date-range history and one-request comment trees. Source: [06-algolia-search-api](../../../docs/06-algolia-search-api.md), quirks in [07](../../../docs/07-gotchas-and-edge-cases.md).

## When to use
- Building `/api/search` or a topic feed (AI, security, Rust...).
- Loading a whole thread in one call instead of N+1 item fetches.
- Any query by date, points or comment count.

**Do not** use it as the source of truth for current front-page ranking or live updates - Firebase owns that; Algolia can lag seconds to minutes.

## Core facts
- Base `https://hn.algolia.com/api/v1`, no auth, third party (Algolia, not YC).
- **Rate limit: 10,000 requests/hour per IP** (~2.7 req/s). Exceeding can get the IP blocked.

| Endpoint | Purpose |
|---|---|
| `GET /search?query=` | Relevance, then points, then comments |
| `GET /search_by_date?query=` | Newest first |
| `GET /items/{id}` | Item with **nested `children`** tree |
| `GET /users/{username}` | `{username, about, karma}` |

| Param | Notes |
|---|---|
| `query` | Full text |
| `tags` | `story, comment, poll, pollopt, show_hn, ask_hn, front_page, author_{USER}, story_{ID}`. Comma = AND, parentheses = OR: `author_pg,(story,poll)` |
| `numericFilters` | `created_at_i`, `points`, `num_comments` with `< <= = > >=`, comma-joined (AND): `points>100,created_at_i>1732320000` |
| `page`, `hitsPerPage` | 0-based page, default 20 |
| `restrictSearchableAttributes` | e.g. `url` to match domains |

## Recipes
| Need | Request |
|---|---|
| Front page now | `/search?tags=front_page` |
| Latest about LLMs | `/search_by_date?query=LLM&tags=story` |
| Rust, last 24 h, >50 pts | `/search_by_date?query=rust&tags=story&numericFilters=created_at_i>{now-86400},points>50` |
| Links to github.com | `/search?query=github.com&restrictSearchableAttributes=url&tags=story` |
| Latest Show HN | `/search_by_date?tags=show_hn` |
| All comments on story | `/search?tags=comment,story_{ID}` |
| Whole thread | `/items/{ID}` |

## Field mapping to the Story model
`objectID` (**string**) -> `id` (`Number(...)`), `author` -> `by`, `points` -> `score`, `num_comments` -> `descendants`, `created_at_i` -> `time`, `story_text`/`comment_text` -> `text` (HTML, sanitize), `children` -> nested `kids`. `points`/`num_comments`/`title`/`url` may be `null` in hits - default them.

```ts
export interface AlgoliaHit {
  objectID: string; title: string | null; url: string | null; author: string;
  points: number | null; num_comments: number | null; story_text: string | null;
  created_at_i: number; _tags: string[];
}
export const hitToStory = (h: AlgoliaHit): Story | null => h.title ? ({
  id: Number(h.objectID), kind: classifyTitle(h.title, h._tags),
  title: decodeEntities(h.title), url: h.url || undefined, domain: domainOf(h.url),
  hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`, author: h.author,
  points: h.points ?? 0, comments: h.num_comments ?? 0,
  createdAt: new Date(h.created_at_i * 1000), fetchedAt: new Date(),
}) : null;
```

## Netlify proxy procedure
Browser -> `/api/search` (Netlify Function) -> Algolia. Never let browsers hit Algolia directly in production.

1. Validate input: `q` <= 100 chars, `tags` from an allow-list, `page` 0-50, `hitsPerPage` <= 50. Reject anything else (400).
2. Build a **normalized cache key** (lowercased, trimmed query + sorted params).
3. Look in Netlify Blobs store `search` (or rely on CDN cache) - return if fresh.
4. Fetch Algolia with `AbortSignal.timeout(5000)`; on 429/5xx return stale cache if any, else 503 with `Retry-After`.
5. Map hits to `Story[]`, return with CDN cache headers.

```ts
// netlify/functions/search.mts
import type { Config, Context } from "@netlify/functions";
const ALLOWED_TAGS = new Set(["story", "show_hn", "ask_hn", "front_page", "comment"]);
export default async (req: Request, _ctx: Context) => {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 100);
  const tag = u.searchParams.get("tags") ?? "story";
  const page = Math.min(50, Math.max(0, Number(u.searchParams.get("page") ?? 0) | 0));
  if (!ALLOWED_TAGS.has(tag)) return new Response("bad tags", { status: 400 });
  const sort = u.searchParams.get("sort") === "date" ? "search_by_date" : "search";
  const api = new URL(`https://hn.algolia.com/api/v1/${sort}`);
  api.search = new URLSearchParams({ query: q, tags: tag, page: String(page), hitsPerPage: "30" }).toString();
  const res = await fetch(api, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return new Response("search unavailable", { status: 503, headers: { "Retry-After": "30" } });
  const body = await res.json();
  return Response.json({ stories: body.hits.map(hitToStory).filter(Boolean), page: body.page, nbPages: body.nbPages }, {
    headers: { "Netlify-CDN-Cache-Control": "public, s-maxage=120, stale-while-revalidate=600, durable",
               "Cache-Control": "public, max-age=30" },
  });
};
export const config: Config = { path: "/api/search" };
```

## Rate-limit budget
- Target < 2,000 Algolia calls/hour total (20% of the limit) so spikes are survivable.
- CDN `s-maxage` 60-300 s on search; topic feeds pre-built by the Scheduled Function (e.g. 6 topics x 12 runs/hr = 72 calls/hr).
- Netlify Functions run on shared cloud egress IPs, so the per-IP budget may be partly consumed by others: log 429s and back off rather than assume a full 10k.

## Pitfalls
- Comparing `objectID` (string) to Firebase `id` (number) with `===`.
- Using `/search` when the user expects newest-first (use `/search_by_date`).
- Spaces in `numericFilters` - keep them out; URL-encode `>`/`<` via `URLSearchParams`.
- Rendering `_highlightResult` HTML without sanitizing.
- Treating Algolia's `front_page` as exact current ranking.

## Testing
Record fixtures of `/search`, `/search_by_date` and `/items/{id}` under `tests/fixtures/algolia/`; unit-test the mapper (null points, string IDs), the param validator and the stale-on-error path (see `software-testing`).

## Used by
solution-architect, hn-api-integration-engineer, search-discovery-engineer, data-engineer, qa-test-engineer
