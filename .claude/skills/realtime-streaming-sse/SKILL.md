---
name: realtime-streaming-sse
description: Guides live-update work against HN's Firebase REST streaming - browser EventSource on /v0/topstories.json, put/patch/keep-alive/cancel events, applying index patches, "N new stories" UX, reconnect/backoff, visibility handling and polling fallback to the cached Netlify feed API. Use when implementing or debugging live feeds, score refresh, stream reconnects, or deciding SSE vs SDK vs polling.
metadata:
  id: S03
  used-by: [solution-architect, hn-api-integration-engineer, frontend-engineer, performance-realtime-engineer, qa-test-engineer]
  mvp: true
---
# Real-time Streaming (SSE / EventSource)

## Purpose
Deliver the MVP promise "new top stories appear within 60 s without reload" ([09](../../../docs/09-agent-team-briefing.md)) on a Netlify host. Source: [04-realtime-updates](../../../docs/04-realtime-updates.md).

## When to use
- Building the live "3 new stories" pill or live score/comment counts.
- Debugging dropped streams, duplicate events, or a stream that never updates.
- Choosing between SSE, Firebase SDK and polling.

## Architecture on Netlify (decided constraint)
Netlify Functions are short-lived, so **no server-side always-on ingestor**. Instead:
1. **Browser** opens `EventSource` directly to `https://hacker-news.firebaseio.com/v0/<list>.json` for list changes.
2. **Item data** for new IDs comes from our cached API (`/api/feeds/:name`, `/api/stories/:id`) or, for a few items, direct `/item/{id}.json`.
3. **Fallback**: if the stream fails repeatedly, poll `/api/feeds/:name` (served from Blobs/CDN) every 60 s.
4. The Scheduled Function keeps the cache fresh every 1-5 min independently.

| Option | Use here? |
|---|---|
| A. REST SSE via `EventSource` | **Yes** - zero dependencies, auto-reconnect |
| B. Firebase JS SDK (`onValue`) | Only if per-item listeners become essential; large bundle |
| C. Polling our API | Fallback and for blocked networks |

## Protocol
| Event | `data` | Action |
|---|---|---|
| `put` | `{"path","data"}` | Replace value at `path`. First event is `put` at `/` with full list |
| `patch` | `{"path","data":{...}}` | For each key in `data`, replace that child under `path` |
| `keep-alive` | `null` | Ignore (not data) |
| `cancel` | string | Server closed stream: close and reconnect with backoff |
| `auth_revoked` | string | N/A (no auth) |

For `/topstories` a patch usually looks like `{"path":"/","data":{"3":50617001,"4":50611576}}`. Paths can also be `"/3"` with a scalar `data` - handle both. Firebase may **307-redirect** to another `*.firebaseio.com` host; browsers follow it, but CSP `connect-src` must allow it.

## Reference implementation
```ts
// src/lib/live/topStream.ts
type Listener = (ids: number[]) => void;

export function applyEvent(ids: number[], type: "put" | "patch", raw: string): number[] {
  const { path, data } = JSON.parse(raw) as { path: string; data: unknown };
  const next = ids.slice();
  if (path === "/") {
    if (type === "put") return Array.isArray(data) ? (data as number[]) : Object.values(data ?? {}) as number[];
    for (const [i, id] of Object.entries(data as Record<string, number | null>)) {
      if (id == null) next.length = Math.min(next.length, +i); else next[+i] = id;
    }
    return next;
  }
  const idx = Number(path.slice(1));                // "/3" -> 3
  if (Number.isInteger(idx)) { if (data == null) next.splice(idx, 1); else next[idx] = data as number; }
  return next;
}

export function openListStream(list: string, onIds: Listener, onFallback: () => void) {
  let ids: number[] = [], es: EventSource | null = null, failures = 0, timer: number | undefined;
  const connect = () => {
    es = new EventSource(`https://hacker-news.firebaseio.com/v0/${list}.json`);
    es.addEventListener("put",   e => { failures = 0; ids = applyEvent(ids, "put", (e as MessageEvent).data); onIds(ids); });
    es.addEventListener("patch", e => { ids = applyEvent(ids, "patch", (e as MessageEvent).data); onIds(ids); });
    es.addEventListener("cancel", () => reconnect());
    es.onerror = () => { if (++failures >= 5) { close(); onFallback(); } };   // EventSource retries itself first
  };
  const reconnect = () => { close(); timer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** failures++)); };
  const close = () => { es?.close(); es = null; clearTimeout(timer); };
  const onVis = () => (document.hidden ? close() : connect());
  document.addEventListener("visibilitychange", onVis);
  connect();
  return () => { document.removeEventListener("visibilitychange", onVis); close(); };
}
```

## UX rules
- **Do not reorder the list under the reader.** Compute `newIds = ids.slice(0,30)` minus rendered IDs; show "N new stories" pill; apply on click (or when scrolled to top).
- Throttle UI updates to at most once per 2-5 s; streams can patch many indices in bursts.
- Fetch item data for new IDs only (bounded concurrency; prefer `/api/stories/:id` so the CDN absorbs it).
- Refresh scores of visible stories on a slower cadence (2-5 min) via our feed API, not one stream per item.
- Close streams when the tab is hidden; reconnect on visible.
- Announce new-story counts via an `aria-live="polite"` region.

## Fallback / polling procedure
1. After 5 consecutive errors (or stream blocked by network/CSP), switch to polling `/api/feeds/top?page=0` every 60 s with jitter.
2. Diff IDs against what's rendered; same pill UX.
3. Every 5 min, try the stream again; switch back on first `put`.

## Pitfalls
- Treating `keep-alive` as data, or `JSON.parse(null)` crashes on it.
- Forgetting the first `put` replaces everything (not a diff).
- Opening one `EventSource` per story (connection limits, battery). One list stream per open tab.
- Missing `connect-src https://*.firebaseio.com` in CSP -> stream silently fails after redirect.
- Corporate proxies/our sandbox block or buffer SSE (sandbox returns 403) - always have the fallback.
- Trying to hold SSE inside a Netlify Function: it will be killed at the function timeout.

## Testing
- Unit-test `applyEvent` with fixtures: initial put, index patch, `"/3"` path, null deletions, keep-alive.
- Playwright: stub `window.EventSource` via `page.addInitScript` with a fake that emits scripted events; assert the pill appears and the list doesn't jump. Test fallback by making the fake error 5 times.

## Used by
solution-architect, hn-api-integration-engineer, frontend-engineer, performance-realtime-engineer, qa-test-engineer
