# 04 — Real-time Updates

"Updated tech news" is the core requirement, and the HN API is unusually good at it because it sits on Firebase.

## Option A: Server-Sent Events over REST (recommended for a backend)

Any endpoint can be streamed by sending `Accept: text/event-stream`:

```bash
curl -N -H "Accept: text/event-stream" https://hacker-news.firebaseio.com/v0/topstories.json
```

Protocol (Firebase REST streaming):

| Event | `data` payload | What to do |
|---|---|---|
| `put` | `{"path": "...", "data": ...}` | Replace everything at `path` (relative to the URL) with `data`. The first event is a `put` at `/` with the full current value |
| `patch` | `{"path": "...", "data": {...}}` | For each key in `data`, replace that child at `path` |
| `keep-alive` | `null` | Nothing; the connection is alive |
| `cancel` | error string | Server closed the stream. Reconnect with backoff |
| `auth_revoked` | string | Not applicable (no auth) |

Rules:
- Follow **HTTP 307 redirects** (Firebase may redirect to another host).
- Reconnect on drop with exponential backoff. The browser `EventSource` does this automatically.
- For `/topstories`, a `patch` typically updates individual array indices (`{"path":"/","data":{"3":50617001,"4":...}}`). Keep a local array and apply patches by index.

Browser:

```js
const es = new EventSource("https://hacker-news.firebaseio.com/v0/topstories.json");
let ids = [];
es.addEventListener("put", e => {
  const { path, data } = JSON.parse(e.data);
  if (path === "/") ids = data ?? [];
});
es.addEventListener("patch", e => {
  const { path, data } = JSON.parse(e.data);
  if (path === "/") for (const [i, id] of Object.entries(data)) ids[+i] = id;
});
```

Node: use the `eventsource` npm package or `undici` fetch and parse the stream.

## Option B: Firebase client SDK

```js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";

const app = initializeApp({ databaseURL: "https://hacker-news.firebaseio.com" });
const db = getDatabase(app);

onValue(ref(db, "v0/topstories"), snap => {
  const ids = snap.val();           // number[]
});
onValue(ref(db, "v0/item/50611576"), snap => {
  const item = snap.val();           // live score / descendants updates
});
```

Pros: built-in reconnection, local caching, per-item listeners. Cons: larger bundle, SDK-specific; many concurrent item listeners for big lists.

## Option C: Polling

Simplest. Poll `/topstories.json` every 30–60 s, diff the ID list, fetch only **new** IDs, and refresh scores/comment counts of visible items on a slower cadence (e.g. every 2–5 min). Good enough for an MVP and for serverless/cron setups.

## `/v0/updates` — the change feed

`/updates.json` returns recently changed item IDs and usernames. Use it to:
- Refresh cached items whose score or comments changed, **if** they're in your cache.
- Avoid re-fetching every visible story on each tick.

Pattern: stream or poll `/updates`, intersect `items` with your cache's keys, re-fetch the intersection.

## Recommended strategy for our app

1. **Backend ingestor** keeps one SSE connection each to `/topstories`, `/newstories`, `/beststories` (and optionally ask/show/job) plus `/updates`.
2. On list change, fetch newly seen item IDs (bounded concurrency) and upsert into a cache/DB.
3. On `/updates`, re-fetch cached items that changed.
4. Push diffs to clients over WebSocket/SSE, or let clients poll the app's own API (cheap, since it's cached).
5. Fall back to polling if a stream stays down longer than N minutes.
