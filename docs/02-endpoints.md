# 02 — Endpoint Reference

Base: `https://hacker-news.firebaseio.com/v0`. Append `.json`. Add `?print=pretty` for human-readable output while debugging.

## Summary table

| Endpoint | Returns | Size | Notes |
|---|---|---|---|
| `/item/{id}.json` | Item object (story, comment, job, poll, pollopt) or `null` | 1 | Core building block |
| `/user/{username}.json` | User object or `null` | 1 | Username is **case-sensitive**. Only users with public activity exist |
| `/maxitem.json` | Integer (current largest item ID) | 1 | Walk backward from here to discover every item |
| `/topstories.json` | `int[]` | up to 500 | Front-page ranking. **Includes jobs** |
| `/newstories.json` | `int[]` | up to 500 | Newest submissions |
| `/beststories.json` | `int[]` | list | "Best" ranking (highest-voted recent). Check `length` at runtime |
| `/askstories.json` | `int[]` | up to 200 | Latest Ask HN |
| `/showstories.json` | `int[]` | up to 200 | Latest Show HN |
| `/jobstories.json` | `int[]` | up to 200 | Latest YC job posts |
| `/updates.json` | `{ items: int[], profiles: string[] }` | small | Recently changed items and user profiles |

List arrays are **ordered** in the same order as the corresponding HN page (rank 1 first).

## Examples

### Item
```
GET /v0/item/8863.json
```
```json
{
  "by": "dhouston", "descendants": 71, "id": 8863,
  "kids": [8952, 9224, 8917],
  "score": 111, "time": 1175714200,
  "title": "My YC app: Dropbox - Throw away your USB drive",
  "type": "story", "url": "http://www.getdropbox.com/u/2/screencast.html"
}
```

### User
```
GET /v0/user/jl.json
```
```json
{ "about": "This is a test", "created": 1173923446, "id": "jl", "karma": 2937, "submitted": [8265435, 8168423] }
```

### Max item
```
GET /v0/maxitem.json   ->   50617687
```

### Story lists
```
GET /v0/topstories.json   ->   [50611576, 50614249, 50617499, ...]
```

### Updates
```
GET /v0/updates.json
```
```json
{ "items": [50612625, 50614550, ...], "profiles": ["emptybits", "btown", ...] }
```

## Firebase REST query parameters that work here

Because the backend is Firebase Realtime Database, the standard REST params apply:

| Param | Use for us |
|---|---|
| `print=pretty` | Debug formatting |
| `print=silent` | Write-only; not useful (API is read-only) |
| `shallow=true` | Return only keys (values truncated to `true`). Cannot combine with other params |
| `orderBy="$key"&limitToFirst=N` | Fetch only the first N entries of a list, e.g. top 30 stories. Returns an **object keyed by index** (`{"0":id,"1":id}`), not an array. Verify in a spike before relying on it |
| `limitToLast`, `startAt`, `endAt`, `equalTo` | Firebase filters; require `orderBy` |
| `timeout=3s` | Server-side read timeout (max 15 min); 400 if exceeded |

Downloading the full 500-ID list is only ~5 KB, so slicing client-side (`ids.slice(0, 30)`) is usually simpler and safer than `limitToFirst`.

## Streaming

Any endpoint above can be streamed with `Accept: text/event-stream`. See [04-realtime-updates.md](04-realtime-updates.md).

## What does NOT exist

- No search or keyword filter (use Algolia, [06](06-algolia-search-api.md))
- No "items by date range" query
- No comment-count-by-story endpoint other than `descendants`
- No batch fetch (`/items?ids=1,2,3`). One request per item
- No user's upvoted/favorite list, no authenticated endpoints
- No "past" (front page for a given day) endpoint. Use Algolia `tags=front_page` + date filters, or archive your own snapshots
