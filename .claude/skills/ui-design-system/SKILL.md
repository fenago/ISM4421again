---
name: ui-design-system
description: Defines the visual design system for the HN tech-news app, covering type scale, color tokens, light/dark themes, spacing, responsive layout and core components (story row, comment, live pill). Use when asked to "design the feed", "add dark mode", "define tokens", "make it responsive", "style the comment tree", review UI consistency, or create brand visuals that don't mimic HN/YC.
metadata:
  id: S17
  used-by: [frontend-engineer, ui-designer, accessibility-specialist, product-marketing-strategist]
  mvp: false
---
# UI / Visual Design & Design Systems

## Purpose
Give the app a dense, fast, readable interface with one source of truth for tokens and components, consistent across feeds, story view, comments and marketing pages.

## When to use
- Creating or changing tokens, themes, typography or layout.
- Designing a new component or reviewing a PR for visual consistency.
- Brand/landing visuals (with product-marketing-strategist).

## Design principles for this app
1. **Density with clarity:** a feed row should fit title + meta in ≤ 2 lines on desktop; 30 items scannable.
2. **Text first:** no hero images per story (HN items have no images; fetching OG images would add N+1 and privacy cost).
3. **Calm live updates:** never reflow the list under the reader; show a "3 new stories" pill instead.
4. **Distinct from HN:** don't copy HN's orange (#ff6600) header or the "Y" logo; avoid implied affiliation.

## Tokens (CSS custom properties, `src/styles/tokens.css`)
```css
:root {
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --text-xs: .75rem; --text-sm: .875rem; --text-md: 1rem; --text-lg: 1.125rem; --text-xl: 1.375rem;
  --leading: 1.45;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px;
  --radius: 6px;
  --bg: #ffffff; --surface: #f6f7f9; --text: #16181d; --text-muted: #5b6270;
  --accent: #2f5bd3; --accent-contrast: #ffffff; --border: #e3e6eb;
  --visited: #6b4fbb; --focus: #1a73e8; --danger: #b42318;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0f1115; --surface: #171a21; --text: #e7e9ee; --text-muted: #a0a7b4;
  --accent: #7aa2ff; --accent-contrast: #0f1115; --border: #2a2f3a; --visited: #b9a3ff; --focus: #8ab4ff;
}}
:root[data-theme="dark"] { /* same dark values */ }
```
- Every text/background pair must pass WCAG AA (4.5:1 body, 3:1 large text and UI). Verify with accessibility-wcag before merging token changes.
- Theme toggle: system default, user override stored in `localStorage` (no account needed).

## Core components
| Component | Contents | Notes |
|---|---|---|
| `StoryRow` | rank, title (link to original URL), domain, points, "N comments" (link to our view + HN), age, `by user`, kind badge (Ask/Show/Job) | Visited-link color; job rows labelled "Job" |
| `FeedTabs` | Top, New, Best, Ask, Show, Jobs | URL-addressable `/top`, `/new`… |
| `NewStoriesPill` | "3 new stories – show" | `aria-live="polite"`; sticky top |
| `CommentNode` | author, age, sanitized HTML, collapse toggle, child count | Indent max ~6 levels then flatten with "continue thread" |
| `TopicChip` | topic label | Filter toggle, `aria-pressed` |
| `SearchBox` | query, filters (date, points) | Debounce 300 ms (Algolia budget) |
| `AttributionFooter` | "Data from the HN API · Not affiliated with HN or Y Combinator" | On every page |

## Responsive layout
- Breakpoints: `< 640px` single column, meta wraps under title; `640–1024px` comfortable; `> 1024px` max content width ~ 760px for readability (feeds), optional side panel for topics.
- Tap targets ≥ 44×44 px on mobile (collapse toggles, tabs).
- Long titles/URLs: `overflow-wrap: anywhere`; code blocks in comments scroll horizontally inside their box.

## Procedure: add a component
1. Check whether existing tokens/components cover it.
2. Sketch states: default, hover, focus-visible, visited, loading (skeleton), empty, error, dead/deleted placeholder.
3. Implement with tokens only (no raw hex in components).
4. Check both themes, 320px width, 200% zoom, keyboard focus.
5. Add a story/visual test or screenshot to the PR.

## Pitfalls
- Raw colors in components break dark mode.
- Animating list reorders on every score change (motion sickness, lost place).
- Truncating titles so the domain/attribution disappears.
- Low-contrast muted meta text in dark mode.

## Used by
- frontend-engineer
- ui-designer
- accessibility-specialist
- product-marketing-strategist
