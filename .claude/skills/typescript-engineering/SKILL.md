---
name: typescript-engineering
description: Sets the TypeScript conventions for the HN app - strict tsconfig, one typed HN/Algolia client module with timeouts, jittered retries, bounded concurrency (mapLimit), null handling, tolerant parsing and order-preserving fan-out - plus error-handling and module-layout rules shared by Functions and frontend. Use when writing or reviewing any TS/JS code, adding a client call, handling async concurrency, or designing types for HN data.
metadata:
  id: S04
  used-by: [solution-architect, hn-api-integration-engineer, frontend-engineer, search-discovery-engineer, data-engineer, ai-ml-engineer, performance-realtime-engineer, security-engineer, qa-test-engineer]
  mvp: true
---
# TypeScript / JavaScript Engineering

## Purpose
Keep one language and one set of patterns across Netlify Functions, the Scheduled Function and the browser. Conventions come from [09-agent-team-briefing](../../../docs/09-agent-team-briefing.md); fetch patterns from [05](../../../docs/05-fetching-patterns.md); types from [03](../../../docs/03-data-model.md).

## When to use
Any time you write TS: new client calls, normalizers, Functions, components, tests.

## Conventions (shared contract)
- TypeScript end-to-end; Node 20+ in Functions (global `fetch`, `AbortSignal.timeout`).
- **Raw HN types only in `src/lib/hn/types.ts`.** UI and Functions' responses use normalized `Story` / `Comment`.
- **All HN/Algolia network access goes through `src/lib/hn/client.ts` / `src/lib/algolia/client.ts`.** No ad-hoc `fetch("https://hacker-news...")` elsewhere.
- Convert Unix seconds to `Date`/ISO once, in the normalizer.
- Parsers tolerate unknown fields; never use exact/strict schemas that reject extras.
- No secrets needed for HN/Algolia; if a secret ever appears, read it via env in Functions only.

Suggested layout:
```
src/lib/hn/{types,client,normalize,classify}.ts
src/lib/algolia/client.ts
src/lib/html/{sanitize,decode}.ts
src/lib/live/topStream.ts
netlify/functions/{feeds,story,search}.mts, refresh-feeds.mts (scheduled)
tests/fixtures/{hn,algolia}/*.json
```

## tsconfig essentials
```json
{ "compilerOptions": {
  "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
  "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": false,
  "noImplicitOverride": true, "verbatimModuleSyntax": true, "skipLibCheck": true,
  "lib": ["ES2022", "DOM", "DOM.Iterable"], "types": ["node"]
} }
```
`noUncheckedIndexedAccess` matters here: `ids[0]` and `item.kids?.[i]` are genuinely possibly undefined.

## The client module
```ts
// src/lib/hn/client.ts
import type { HNItem, HNUser, HNUpdates } from "./types";
export const HN_BASE = "https://hacker-news.firebaseio.com/v0";
export type FeedName = "top" | "new" | "best" | "ask" | "show" | "job";

export class HttpError extends Error {
  constructor(public status: number, public path: string) { super(`${status} ${path}`); }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const retryable = (e: unknown) =>
  !(e instanceof HttpError) || e.status >= 500 || e.status === 429;

export async function getJSON<T>(path: string, opts: { timeoutMs?: number; retries?: number } = {}): Promise<T | null> {
  const { timeoutMs = 8000, retries = 2 } = opts;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${HN_BASE}/${path}.json`, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new HttpError(res.status, path);
      return (await res.json()) as T | null;          // literal null = not found
    } catch (e) {
      if (attempt >= retries || !retryable(e)) throw e;
      await sleep(250 * 2 ** attempt + Math.random() * 250);   // jittered backoff
    }
  }
}

export async function mapLimit<T, R>(xs: readonly T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length);
  let next = 0;
  const worker = async () => { while (next < xs.length) { const k = next++; out[k] = await fn(xs[k]!, k); } };
  await Promise.all(Array.from({ length: Math.min(limit, xs.length) }, worker));
  return out;                                         // same order as input = rank preserved
}

export const getFeedIds = async (f: FeedName) => (await getJSON<number[]>(`${f}stories`)) ?? [];
export const getItem = (id: number) => getJSON<HNItem>(`item/${id}`);
export const getUser = (id: string) => getJSON<HNUser>(`user/${encodeURIComponent(id)}`);
export const getUpdates = () => getJSON<HNUpdates>("updates");
```

## Order-preserving page with backfill
```ts
export async function getFeedPage(f: FeedName, page = 0, size = 30): Promise<Story[]> {
  const ids = await getFeedIds(f);
  const out: Story[] = [];
  let cursor = page * size;
  while (out.length < size && cursor < ids.length) {
    const batch = ids.slice(cursor, cursor + (size - out.length));
    const items = await mapLimit(batch, 10, id => getItem(id).catch(() => null));
    items.forEach((it, i) => { const s = it && toStory(it, cursor + i + 1); if (s) out.push(s); });
    cursor += batch.length;
  }
  return out;
}
```

## Error-handling rules
- Per-item failures **degrade**, not fail the page: `.catch(() => null)` then filter.
- A list-endpoint failure fails the request; the caller serves stale cache.
- Only retry idempotent GETs, on network/5xx/429. Never retry 4xx.
- Always pass a timeout. Netlify sync Functions have a short budget; give per-request timeouts well under it.
- Use `unknown` in `catch`, narrow with `instanceof`. Log `{ path, status, attempt }`, never whole bodies.
- Narrow with type guards instead of `as` casts on external data:
```ts
export const isItem = (x: unknown): x is HNItem =>
  typeof x === "object" && x !== null && typeof (x as { id?: unknown }).id === "number";
```

## Concurrency guidance
- Default limit 10 (8-20 ok). Never `Promise.all(ids.map(getItem))` on 500 IDs.
- Use `Promise.allSettled` when partial results are acceptable and you need per-item errors.
- Pass `AbortSignal` down so a cancelled request (user navigated away) stops fan-out.

## Pitfalls
- `item.time` used as milliseconds -> dates in 1970.
- `objectID` string vs number IDs.
- `ids.indexOf` assumptions after filtering dead items (rank should come from original list index).
- Mutating cached arrays shared between requests in a warm Function instance - copy first.
- Top-level `await` network calls in Function modules (runs on cold start, not per request).

## Used by
solution-architect, hn-api-integration-engineer, frontend-engineer, search-discovery-engineer, data-engineer, ai-ml-engineer, performance-realtime-engineer, security-engineer, qa-test-engineer
