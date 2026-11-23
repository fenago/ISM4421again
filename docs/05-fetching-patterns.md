# 05 — Fetching Patterns, Performance & Caching

## The N+1 problem

Rendering the front page = 1 request for `/topstories` + 30 item requests. Rendering one story with comments = 1 + (every comment in the tree) requests, which can be **2,000+** for a hot thread.

## Bounded parallel fan-out

```ts
const BASE = "https://hacker-news.firebaseio.com/v0";

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  const res = await fetch(`${BASE}/${path}.json`, { signal });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T | null>;
}

async function mapLimit<T, R>(xs: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, xs.length) }, async () => {
    while (i < xs.length) { const k = i++; out[k] = await fn(xs[k]); }
  });
  await Promise.all(workers);
  return out;
}

export async function topStories(n = 30) {
  const ids = (await getJSON<number[]>("topstories")) ?? [];
  const items = await mapLimit(ids.slice(0, n), 10, id => getJSON<HNItem>(`item/${id}`));
  return items.filter(x => x && !x.deleted && !x.dead); // keep list order
}
```

Guidance:
- Concurrency of **8–20** is a reasonable default. Firebase handles HTTP/2 multiplexing well.
- Preserve list order (rank) after parallel fetches.
- Use `AbortController` timeouts (e.g. 5–10 s) and retry with jittered backoff on 5xx/network errors.
- No documented rate limit does not mean unlimited. Cache aggressively so traffic is proportional to **change**, not to users.

## Pagination

Lists are up to 500/200 IDs. Paginate **client-side**: page `p` of size 30 → `ids.slice(p*30, p*30+30)`. Snapshot the ID list per session so items don't shift between pages as rankings change.

## Comment trees

- Load lazily: render top-level `kids` first, then fetch replies when a thread is expanded.
- Or fetch breadth-first with a cap (e.g. depth ≤ 3 or ≤ 300 comments) and a "load more" affordance.
- For a whole tree in **one request**, use Algolia `GET /api/v1/items/{id}`, which returns nested `children` ([06](06-algolia-search-api.md)). It may lag slightly behind Firebase.
- `kids` is ranked display order. Preserve it.
- Skip or collapse `deleted`/`dead` comments but keep their children's place in the tree.

## Caching

| Data | Suggested TTL | Why |
|---|---|---|
| Story list IDs | 30–60 s (or stream) | Rankings move constantly |
| Story item (score/descendants) | 1–5 min; invalidate via `/updates` | Mutable while hot |
| Story item older than ~2–3 days | hours to forever | Effectively frozen (HN closes voting/commenting on old items) |
| Comment item | 5–15 min while fresh, then long | Text can be edited for a short window |
| User | hours | Karma changes slowly |

Layering: in-memory LRU → Redis/KV → durable DB (Postgres/SQLite) for history, analytics and "what did I miss" digests.

## Walking backward from `maxitem`

To ingest everything (e.g. all new stories, not just the top 500): read `/maxitem`, then iterate IDs downward to your last-seen ID. The vast majority are comments, so filter `type === "story"`. That's tens of thousands of requests per day. Only do this if you truly need the firehose. `/newstories` + Algolia usually suffice.
