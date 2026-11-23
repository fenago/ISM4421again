---
name: frontend-framework
description: Covers building the HN news UI with React/Next.js (default) or SvelteKit on Netlify - route map, component tree for feeds/story/comments/search, data loading from the cached /api endpoints, live-update state, lazy comment trees, SSR/SSG/ISR trade-offs and Netlify adapters. Use when choosing the framework, scaffolding routes or components, deciding render mode, managing feed state, or building the story/comment views.
metadata:
  id: S05
  used-by: [solution-architect, frontend-engineer, ui-designer, accessibility-specialist, performance-realtime-engineer]
  mvp: true
---
# Frontend Framework (React / Next.js or SvelteKit)

## Purpose
Turn the MVP feature list in [08-app-architecture](../../../docs/08-app-architecture.md) into a fast, accessible UI deployed on Netlify's CDN, consuming our own cached API rather than HN directly.

## When to use
- Framework decision (record as an ADR - see `architecture-decision-records`).
- Adding routes/components, wiring data loading or live updates, rendering comment trees.

## Framework decision guide
| Option | Netlify support | Fit |
|---|---|---|
| **Next.js (App Router)** | Auto-detected; Netlify's Next.js runtime (OpenNext-based) maps SSR/ISR to Functions + CDN | Default in [08](../../../docs/08-app-architecture.md). SSR first paint, React ecosystem |
| Vite + React SPA | Pure static `dist/` + Functions in `netlify/functions` | Simplest mental model; first paint waits for `/api/feeds` (fast from CDN) |
| SvelteKit | `@sveltejs/adapter-netlify` | Smaller bundles; equivalent |

Whatever is chosen: keep HN logic in `src/lib/` framework-agnostic so it is shared with Functions.

## Routes (MVP)
| Route | Content | Data source |
|---|---|---|
| `/` -> `/top` | Feed tabs: top, new, best, ask, show, jobs; 30/page | `GET /api/feeds/:name?page=N` |
| `/:feed?page=N` | Paginated feed | same |
| `/item/:id` | Story header, link-out + HN link, sanitized text, lazy comments | `GET /api/stories/:id` |
| `/search?q=` | Keyword results | `GET /api/search?q=` |
| `/user/:id` (later) | Karma, about | `/api/users/:id` |

## Component tree
```
<AppShell>  (header, FeedTabs, ThemeToggle, SearchBox)
  <FeedPage feed page>
    <NewStoriesPill count onApply/>     (live, aria-live)
    <StoryList> <StoryRow story/>* </StoryList>
    <Pager/>
  <StoryPage id>
    <StoryHeader/> <SafeHtml html={story.textHtml}/>
    <CommentTree rootKids>  <CommentNode id depth/>* (lazy)
  <SearchPage/>
```
`StoryRow` shows rank, title (decoded, plain text), domain, points, comments, age ("3h ago" from `createdAt`), author, a **Job** badge for `kind === "job"`, and a link to `hnUrl`.

## Data loading
```ts
// src/lib/api.ts - the only place the UI calls our backend
export async function fetchFeed(feed: FeedName, page = 0, signal?: AbortSignal) {
  const r = await fetch(`/api/feeds/${feed}?page=${page}`, { signal });
  if (!r.ok) throw new Error(`feed ${r.status}`);
  return (await r.json()) as { stories: Story[]; ids: number[]; generatedAt: string };
}
```
Next.js server component variant (SSR with short revalidate):
```tsx
// app/[feed]/page.tsx
export const revalidate = 60;
export default async function Feed({ params, searchParams }: { params: { feed: FeedName }; searchParams: { page?: string } }) {
  const { stories, ids } = await getFeedFromBlobs(params.feed, Number(searchParams.page ?? 0)); // server-only reader
  return <FeedClient initial={stories} snapshotIds={ids} feed={params.feed} />;
}
```

## State rules
- **Snapshot the ID list per session/page view** so page 2 doesn't shift ([05](../../../docs/05-fetching-patterns.md)). Pagination uses the snapshot; the live stream only feeds the pill.
- Live stream state (`realtime-streaming-sse`) lives in one hook/store per feed: `useLiveFeed(feed, renderedIds) -> { newCount, apply }`.
- Server data cache: TanStack Query (React) or SvelteKit `load` + invalidation. `staleTime` ~30 s for feeds.
- Keep read/unread, hidden domains (V2) in `localStorage` behind a small typed wrapper.

## Comment tree (lazy)
```tsx
function CommentNode({ id, depth }: { id: number; depth: number }) {
  const { data: c } = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id), staleTime: 5 * 60_000 });
  const [open, setOpen] = useState(depth < 2);
  if (!c) return <CommentSkeleton/>;
  if (c.deleted || c.dead) return c.kids?.length ? <Placeholder label={c.deleted ? "[deleted]" : "[dead]"}>{/* children */}</Placeholder> : null;
  return (<article aria-level={depth + 1}>
    <header>{c.by} · <RelTime t={c.time}/></header>
    <SafeHtml html={c.text}/>
    {c.kids?.length ? <button aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? "Hide" : `${c.kids.length} replies`}</button> : null}
    {open && c.kids?.map(k => <CommentNode key={k} id={k} depth={depth + 1}/>)}
  </article>);
}
```
Preserve `kids` order. For huge threads, cap initial render (e.g. top 50 roots) or load the whole tree once from Algolia `/items/{id}` via our Function.

`<SafeHtml>` must sanitize (see `html-sanitization-web-security`) - never `dangerouslySetInnerHTML` / `{@html}` on raw HN HTML.

## SSR/SSG on Netlify
- Feed pages: SSR or ISR with `revalidate` 30-60 s, or SPA fetching `/api/feeds` (CDN-cached). Avoid full SSG at build time - data is stale immediately.
- Story pages: SSR with longer cache for old items (>3 days frozen).
- Never fan out to HN during SSR on user requests; read Blobs or call our API.
- SPA fallback redirect needed for client routing: `/* /index.html 200` (Vite SPA only).

## Accessibility & UX baseline
- Feed is a `<ol>` (rank is semantic). Tabs are links (shareable URLs), not JS-only state.
- Keyboard: `j/k` optional, but full Tab navigation required; visible focus.
- Dark/light via `prefers-color-scheme` + toggle; respect `prefers-reduced-motion` for the pill animation.
- External links: `rel="noopener noreferrer"`, show domain.

## Pitfalls
- Reordering the visible list on every stream patch (CLS, user loses place).
- Rendering titles via innerHTML to "decode entities".
- Hydration mismatch from relative times - render on client or pass a fixed `now`.
- Fetching 30 items from the browser on first paint (N+1) instead of the cached feed.

## Used by
solution-architect, frontend-engineer, ui-designer, accessibility-specialist, performance-realtime-engineer
