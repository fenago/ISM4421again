# 06 — Algolia HN Search API (complement)

The official API has no search. **HN Search by Algolia** fills that gap. It's the engine behind <https://hn.algolia.com> and is linked from the HN footer. It's a third party (Algolia), not Y Combinator, so treat it as a separate dependency.

Docs: <https://hn.algolia.com/api> · Base: `https://hn.algolia.com/api/v1` · No auth · **Rate limit: 10,000 requests/hour per IP**

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /items/{id}` | Item **with full nested comment tree** (`children`) in one call |
| `GET /users/{username}` | `{ username, about, karma }` |
| `GET /search?query=...` | Sorted by relevance, then points, then comments |
| `GET /search_by_date?query=...` | Sorted newest first |

## Query parameters

| Param | Description |
|---|---|
| `query` | Full-text query |
| `tags` | `story`, `comment`, `poll`, `pollopt`, `show_hn`, `ask_hn`, `front_page`, `author_{USERNAME}`, `story_{ID}`. Comma = AND; parentheses = OR, e.g. `author_pg,(story,poll)` |
| `numericFilters` | On `created_at_i`, `points`, `num_comments` with `< <= = > >=`, e.g. `points>100,created_at_i>1732320000` |
| `page`, `hitsPerPage` | Pagination (default 20/page) |
| `restrictSearchableAttributes` | e.g. `url` to match only URLs |

## Recipes for a tech-news app

| Need | Request |
|---|---|
| Front page right now | `/search?tags=front_page` |
| Latest stories about "LLM" | `/search_by_date?query=LLM&tags=story` |
| High-signal Rust stories in last 24h | `/search_by_date?query=rust&tags=story&numericFilters=created_at_i>{now-86400},points>50` |
| Everything linking to github.com | `/search?query=github.com&restrictSearchableAttributes=url&tags=story` |
| Latest Show HN | `/search_by_date?tags=show_hn` |
| All comments on a story | `/search?tags=comment,story_{ID}` |
| Full thread in one call | `/items/{ID}` |

## Response shape (search)

```json
{
  "hits": [{
    "objectID": "1", "title": "Y Combinator", "url": "http://ycombinator.com",
    "author": "pg", "points": 57, "num_comments": 2,
    "story_text": null, "comment_text": null,
    "created_at": "2006-10-09T18:21:51.000Z", "created_at_i": 1160418111,
    "_tags": ["story", "author_pg", "story_1"],
    "_highlightResult": { "title": { "value": "Y Combinator", "matchLevel": "none" } }
  }],
  "page": 0, "nbHits": 11, "nbPages": 1, "hitsPerPage": 20, "processingTimeMS": 1, "query": "pg"
}
```

Field mapping to official API: `objectID`→`id` (string!), `author`→`by`, `points`→`score`, `num_comments`→`descendants`, `created_at_i`→`time`, `children`→nested `kids`.

## When to use which

| Use case | Official Firebase API | Algolia |
|---|---|---|
| Exact current front-page ranking | ✅ source of truth | ~ (`front_page` tag, may lag) |
| Real-time push | ✅ SSE / SDK | ❌ |
| Keyword / topic search | ❌ | ✅ |
| Date-range / points filters | ❌ | ✅ |
| Whole comment tree in one request | ❌ (N+1) | ✅ |
| Rate limit | none documented | 10k/hr/IP |

Recommendation: **Firebase for freshness and ranking, Algolia for search, topic feeds, history and bulk thread loads.** Route Algolia through our backend with caching so we stay under the per-IP limit.
