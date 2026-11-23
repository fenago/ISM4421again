# 03 — Data Model

Everything content-related is an **item**. Users are separate objects.

## Items (`/v0/item/{id}`)

Only `id` is guaranteed. **Every other field is optional** and may be absent (not `null`, simply missing).

| Field | Type | Applies to | Meaning |
|---|---|---|---|
| **id** | int | all | Unique item ID (required) |
| deleted | bool | all | `true` if deleted. Other fields mostly stripped |
| type | string | all | `"job" \| "story" \| "comment" \| "poll" \| "pollopt"` |
| by | string | all | Author username |
| time | int | all | Creation time, **Unix seconds** (multiply by 1000 for JS `Date`) |
| text | string (HTML) | comment, story (Ask/Show/text post), job, poll, pollopt | Body. HTML-escaped |
| dead | bool | all | `true` if killed (flagged/spam). Hidden by default on HN |
| parent | int | comment | Parent comment or story |
| poll | int | pollopt | The poll this option belongs to |
| kids | int[] | story, comment, poll | Direct child comment IDs **in ranked display order** |
| url | string | story, job | External link. Absent for Ask HN; may be `""` for jobs |
| score | int | story, job, poll, pollopt | Points (votes for a pollopt) |
| title | string (HTML) | story, job, poll | Title; may contain HTML entities |
| parts | int[] | poll | Pollopt IDs in display order |
| descendants | int | story, poll | **Total** comment count (whole tree, not just `kids`) |

### Item types in practice

| What you see on HN | `type` | How to recognise it |
|---|---|---|
| Link story | `story` | has `url` |
| Ask HN | `story` | no `url`, has `text`, title starts with `Ask HN:` |
| Show HN | `story` | title starts with `Show HN:` (may have `url` and/or `text`) |
| Launch HN / Tell HN | `story` | title prefix `Launch HN:` / `Tell HN:` |
| Job | `job` | appears in `/topstories` and `/jobstories`; usually no `kids`, no comments |
| Poll | `poll` | has `parts` |
| Poll option | `pollopt` | has `poll` |
| Comment | `comment` | has `parent`; no `title`, `score`, or `url` exposed |

Note: comment scores are **not** exposed by the API.

Observation (2026-11-23): a current link story also carried a short `text` field alongside `url`. Do not assume `url` and `text` are mutually exclusive.

## Users (`/v0/user/{id}`)

| Field | Type | Meaning |
|---|---|---|
| **id** | string | Username, case-sensitive |
| **created** | int | Account creation, Unix seconds |
| **karma** | int | Karma |
| about | string (HTML) | Optional bio |
| submitted | int[] | IDs of the user's stories, polls and comments (newest first). Can be very long |

Only users with public activity are available. Others return `null`.

## Reference TypeScript types

```ts
export type ItemType = "job" | "story" | "comment" | "poll" | "pollopt";

export interface HNItem {
  id: number;
  deleted?: boolean;
  type?: ItemType;
  by?: string;
  time?: number;        // unix seconds
  text?: string;        // HTML
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;       // may contain HTML entities
  parts?: number[];
  descendants?: number;
  [extra: string]: unknown; // API contract: tolerate unknown fields
}

export interface HNUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted?: number[];
}

export interface HNUpdates {
  items: number[];
  profiles: string[];
}

// Fetch results can be null (nonexistent item / user)
export type Maybe<T> = T | null;
```

## Suggested normalized model for the app

Map raw items into an app-level `Story` once, at the edge, so UI code never touches raw HN quirks:

```ts
interface Story {
  id: number;
  kind: "link" | "ask" | "show" | "launch" | "tell" | "job" | "poll";
  title: string;          // entities decoded
  url?: string;
  domain?: string;        // e.g. "github.com", derived from url
  hnUrl: string;          // https://news.ycombinator.com/item?id=<id>
  author?: string;
  points: number;         // score ?? 0
  comments: number;       // descendants ?? 0
  createdAt: Date;        // time * 1000
  textHtml?: string;      // sanitized
  rank?: number;          // position in the list it came from
  fetchedAt: Date;
}
```
