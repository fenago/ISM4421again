# 10 — Sources & Verification Log

## Primary sources
- Official HN API docs: <https://github.com/HackerNews/API> (README, fetched 2026-11-23)
- Firebase Realtime Database REST reference (streaming + query params): <https://firebase.google.com/docs/reference/rest/database>
- Algolia HN Search API: <https://hn.algolia.com/api>

## Live checks (2026-11-23)
| Request | Result |
|---|---|
| `GET /v0/topstories.json` | 200, `application/json`, ~500 IDs, first `50611576` |
| `GET /v0/item/50611576.json` | 200. Story, score 1259, `descendants` 2384, ~500 `kids`, has both `url` and `text` |
| `GET /v0/updates.json` | 200. `{items: [...~140], profiles: [...~50]}` |
| Direct `curl` from dev sandbox | 403 from sandbox proxy (host not allow-listed), environment limitation, not an API issue |

## Items marked "verify in a spike"
- `orderBy="$key"&limitToFirst=N` on list endpoints (Firebase-standard; not documented in the HN README).
- Exact current length of `/beststories`.
- CORS headers for browser-direct use (Firebase REST is widely used from browsers; confirm in the prototype).
