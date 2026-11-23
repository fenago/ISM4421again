# 07 — Gotchas & Edge Cases

A checklist for implementation and QA agents.

## Nulls and missing data
- `/item/{id}` and `/user/{id}` return the literal **`null`** for nonexistent IDs/users (HTTP 200). Always handle `null`.
- All item fields except `id` are optional. `score`, `descendants`, `kids`, `title`, `url`, `by` can each be missing.
- Stories with zero comments may lack `kids` entirely and may have `descendants: 0`.

## Deleted and dead items
- `deleted: true` items retain very little (often just `id`, `type`, `time`, `deleted`, and possibly `parent`/`kids`).
- `dead: true` items are flagged/killed. HN hides them unless "showdead" is on. Filter them from news feeds; render as `[dead]` placeholders inside comment trees if children exist.
- Story lists can momentarily contain IDs that become dead/deleted by the time you fetch them. Filter after fetch, then backfill to keep page size.

## HTML content
- `text`, `title` and `about` are **HTML**. Comments use `<p>` as paragraph *separators* (often no closing tag), `<i>`, `<a href rel="nofollow">`, `<pre><code>`, and entities like `&#x27;` `&quot;` `&gt;`.
- **Sanitize before rendering** (DOMPurify or equivalent, allow-list `p i a pre code`). Never inject raw.
- Decode entities in titles for plain-text contexts (notifications, push, search index).
- Links inside comments may be truncated with `...` in visible text while `href` holds the full URL.

## Types and lists
- `/topstories` **includes jobs**. Filter `type === "job"` if you want news only (or show them labeled).
- `/askstories`, `/showstories`, `/jobstories` cap at **200**. Top/new cap at **500**.
- Ask/Show/Launch/Tell are all `type: "story"`. Classify by title prefix and presence of `url`.
- `url` may be `""` (empty string) for jobs. Treat as missing.
- Job items usually have no `by` link to a real commenter account and no comments.

## Time and identity
- `time`/`created` are **Unix seconds**, not milliseconds.
- Usernames are **case-sensitive** (`/user/PG` ≠ `/user/pg`).
- Item IDs are global across all types and strictly increasing with creation time, so they're a usable proxy for recency.

## Mutability
- Scores and `descendants` change constantly while a story is hot. Never treat a cached item as final in its first ~48 h.
- Titles can be edited by moderators (e.g. de-sensationalized), and URLs occasionally changed. Refresh on `/updates`.
- Ranking positions shift every few seconds. A stable "page 2" requires snapshotting the ID list.

## Transport
- Paths must end in `.json`. Without it, you get Firebase's HTML console redirect, not data.
- Support **307 redirects** on streaming connections.
- `keep-alive` SSE events arrive periodically. Don't treat them as data.
- Some corporate networks/proxies block `*.firebaseio.com` or buffer SSE. (Our own dev sandbox blocks it, so live calls during development may need an allow-listed host or a proxy service.) Plan a polling fallback.

## Algolia-specific
- `objectID` is a **string**. Convert to number to join with Firebase IDs.
- Index updates can lag Firebase by seconds to minutes.
- 10,000 req/hour/IP. Exceeding it can get the IP blocked.

## Legal / etiquette
- Data is public, but link back to the HN discussion (`https://news.ycombinator.com/item?id={id}`) and the original URL, and don't present HN content as your own.
- No official terms beyond the README. Avoid hammering. Cache and share results across users.
