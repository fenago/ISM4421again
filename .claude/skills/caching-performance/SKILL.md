---
name: caching-performance
description: Sets the caching and performance budget for the HN app - per-data TTLs, incremental refresh via /updates, fan-out and concurrency limits inside the Scheduled Function time budget, Netlify CDN/Blobs layering, stale-while-revalidate, client pagination snapshots and Core Web Vitals targets (LCP, INP, CLS). Use when choosing TTLs or cache headers, sizing fan-out, diagnosing slow feeds or timeouts, cutting Function/Algolia usage, or reviewing Web Vitals.
metadata:
  id: S08
  used-by: [solution-architect, hn-api-integration-engineer, search-discovery-engineer, performance-realtime-engineer, devops-netlify-engineer]
  mvp: true
---
# Caching & Performance

## Purpose
Make traffic to HN proportional to **change**, not to users, and keep the UI fast. Source: [05-fetching-patterns](../../../docs/05-fetching-patterns.md); targets from [08](../../../docs/08-app-architecture.md#non-functional-targets).

## Targets
| Metric | Target |
|---|---|
| Feed API p95 (CDN/Blobs hit) | < 200 ms |
| New top story visible in client | < 60 s after HN |
| LCP (mobile, p75) | < 2.5 s |
| INP (p75) | < 200 ms |
| CLS (p75) | < 0.1 |
| JS shipped on feed page | < ~150 KB gzipped |
| Algolia calls | < 2,000/hour (limit 10k/hr/IP) |

## TTL table
| Data | Fresh TTL | Notes |
|---|---|---|
| Feed ID lists | 30-60 s (or live stream) | Rankings move constantly |
| Story item, < 48 h old | 1-5 min; invalidate via `/updates` | Score/comments/title mutable |
| Story item, > 2-3 days old | hours -> forever | Effectively frozen |
| Comment item | 5-15 min while fresh, then long | Editable briefly |
| User | hours | |
| Search results | 2-5 min | Normalize cache key |
| Topic feeds (Algolia) | 5 min | Pre-built by Scheduled Function |

## Cache layers on Netlify
1. **Browser**: `Cache-Control: public, max-age=15` on `/api/feeds/*`; TanStack Query `staleTime` 30 s.
2. **Netlify CDN**: `Netlify-CDN-Cache-Control: public, s-maxage=60, stale-while-revalidate=300, durable` + `Cache-Tag: feed-<name>`.
3. **Netlify Blobs**: feeds and item cache written by the Scheduled Function (source of truth for reads).
4. **Optional DB** (Postgres/Supabase) for history/snapshots (V2 digests, velocity).
5. **Warm Function memory**: tiny LRU for hot `item:` reads - best-effort only; instances are recycled.

Static assets: hashed filenames, `Cache-Control: public, max-age=31536000, immutable`.

## Fan-out budget (Scheduled Function, ~30 s limit)
Naive: 6 feeds x 90 items = 540 item fetches. At concurrency 12 and ~150 ms each that's ~7 s - OK, but grows with retries. Make it **incremental**:

```ts
// inside refresh-feeds
const items = getStore("items");
const updates = new Set((await getUpdates())?.items ?? []);
async function freshItem(id: number): Promise<HNItem | null> {
  const cached = await items.get(`item:${id}`, { type: "json" }) as { item: HNItem; fetchedAt: number } | null;
  const ageH = cached ? (Date.now() / 1000 - (cached.item.time ?? 0)) / 3600 : 0;
  const ttlMs = ageH > 72 ? 6 * 3600_000 : 3 * 60_000;
  if (cached && !updates.has(id) && Date.now() - cached.fetchedAt < ttlMs) return cached.item;
  const item = await getItem(id).catch(() => cached?.item ?? null);
  if (item) await items.setJSON(`item:${id}`, { item, fetchedAt: Date.now() });
  return item;
}
```
- Dedupe IDs across feeds first (top/best overlap heavily) - fetch each item once per run.
- Concurrency 8-20; per-request timeout 5 s; total deadline guard (stop at ~22 s, keep previous blobs).
- Pre-render 3 pages (90) per feed; deeper pages fetched on demand by `/api/feeds` and cached.

## Pagination stability
Return the full `ids` snapshot with page 0; client requests later pages with the snapshot (or `generatedAt`) so items don't shift between pages.

## Comment trees
- Lazy: top-level `kids` first, replies on expand; cap at depth 3 / 300 comments with "load more".
- One-shot alternative: Algolia `/items/{id}` through `/api/stories/:id?tree=1`, CDN-cached 2-5 min (longer for old stories).

## Frontend performance checklist
- [ ] Feed HTML or JSON comes from CDN; no browser N+1 to HN on first paint.
- [ ] Reserve space for the "new stories" pill (no layout shift); never reorder visible rows automatically.
- [ ] System font stack or one preloaded font with `font-display: swap`.
- [ ] Route-level code splitting; comment tree and search loaded lazily.
- [ ] No images in story rows (or fixed-size favicons with width/height).
- [ ] `content-visibility: auto` for long comment lists; virtualize > 500 nodes.
- [ ] Measure: Lighthouse CI on deploy preview or `web-vitals` lib reporting to logs.

## Diagnosing slowness
| Symptom | Check |
|---|---|
| `/api/feeds` slow | CDN miss? Look at `Cache-Status` response header; Blob missing -> 503 path |
| Scheduled run times out | Logged duration in `meta/refresh:last`; reduce items, dedupe, raise concurrency moderately |
| Search 429s | Cache key normalization, `s-maxage`, debounce input (300 ms), min query length 2 |
| High CLS | Pill, fonts, late-loading badges |
| Bad INP | Re-rendering 30 rows on each stream patch - memoize rows, throttle updates |

## Pitfalls
- Same TTL for hot and old items (wastes requests or shows stale scores).
- Cache keys including volatile params (`_t=`), killing hit rate.
- `Promise.all` over 500 IDs.
- Trusting warm-instance memory as a cache layer.

## Used by
solution-architect, hn-api-integration-engineer, search-discovery-engineer, performance-realtime-engineer, devops-netlify-engineer
