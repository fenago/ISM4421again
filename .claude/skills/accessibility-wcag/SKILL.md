---
name: accessibility-wcag
description: Applies WCAG 2.2 AA to the HN tech-news app, covering semantic structure, ARIA, keyboard navigation for feeds and comment trees, live-region updates, contrast and screen-reader testing. Use when asked to "make this accessible", "audit accessibility", "add keyboard shortcuts", "fix contrast", "announce new stories", review a UI PR for a11y, or write automated axe/Playwright a11y tests.
metadata:
  id: S18
  used-by: [frontend-engineer, ui-designer, accessibility-specialist, qa-test-engineer]
  mvp: false
---
# Accessibility (WCAG 2.2 AA)

## Purpose
Ensure every reader, including keyboard-only and screen-reader users, can browse feeds, follow live updates, read comment threads and search. Target: WCAG 2.2 Level AA (docs/08 non-functional target: keyboard navigation, readable themes).

## When to use
- Any UI PR; design token changes; new interactive components.
- Before public launch (full audit) and on each release (automated checks in CI).

## Core knowledge: WCAG 2.2 AA items that matter most here
| Criterion | Applies to |
|---|---|
| 1.3.1 Info & relationships | Feed as a list (`<ol>` with rank), comments as nested lists, headings per page |
| 1.4.3 / 1.4.11 Contrast | Body text 4.5:1, large text and UI components/focus 3:1, both themes |
| 1.4.10 Reflow / 1.4.4 Resize | 320 px width and 200% zoom without horizontal scroll (except code blocks) |
| 2.1.1 Keyboard / 2.1.2 No trap | All actions reachable; comment collapse; modals |
| 2.4.3 Focus order / 2.4.7 Focus visible / 2.4.11 Focus not obscured (new in 2.2) | Sticky header and "new stories" pill must not cover focused item |
| 2.5.8 Target size (minimum, new in 2.2) | ≥ 24×24 CSS px targets (aim for 44 on mobile) |
| 3.2.2 On input | Topic toggles don't navigate unexpectedly |
| 4.1.2 Name, role, value | Tabs, toggles, collapse buttons |
| 4.1.3 Status messages | "3 new stories", search result counts via live regions |
| 2.2.2 Pause, stop, hide | Auto-updating content: list must not auto-reorder; provide manual "show" |

## Component patterns
- **Feed:** `<main><h1>Top stories</h1><ol>` with each `<li><article aria-labelledby>`; title link first, then meta links. Rank via `<ol start>` for page 2+.
- **Feed tabs:** links to routes (`/top`, `/new`) with `aria-current="page"`, simpler and more robust than ARIA tabs.
- **New stories pill:** `<button>` "Show 3 new stories"; separate `<div role="status" aria-live="polite">` announces count changes (throttle announcements to ≥ 30 s). After click, move focus to the first new item.
- **Comment tree:** nested `<ul>`; each comment has a `<button aria-expanded aria-controls>` "Collapse comment by {user}, {n} replies". Deleted/dead render as text "[deleted]" / "[dead]" placeholders.
- **Sanitized HTML:** keep `<p> <i> <a> <pre><code>`; links in comments get discernible text (HN truncates visible URLs with `...`, fine since href is full).
- **Keyboard shortcuts (optional, power readers):** `j/k` next/prev story, `o` open, `c` comments, `?` help. Must be disable-able (2.1.4 Character key shortcuts) and never fire inside inputs.
- **Skip link** to main content; visible focus ring using `--focus` token, ≥ 2 px.
- Respect `prefers-reduced-motion` for pill/collapse animations.

## Audit procedure
1. Automated: `@axe-core/playwright` on `/top`, `/item/:id` (fixture with deep thread + dead/deleted), `/search?q=rust`, both themes. Fail CI on serious/critical violations.
2. Keyboard pass: Tab through a feed page and a story page; check order, visible focus, no traps, pill doesn't obscure focus.
3. Screen reader: VoiceOver + Safari (macOS/iOS) and NVDA + Firefox (Windows). Verify list counts announced, comment collapse state, live announcements not spammy.
4. Zoom 200% and 320 px viewport; check reflow.
5. Contrast: check all token pairs (light + dark) incl. muted meta, visited links, focus ring.
6. Record findings as issues labelled `a11y` with WCAG criterion and severity.

## Playwright snippet
```ts
import AxeBuilder from "@axe-core/playwright";
test("feed has no serious a11y violations", async ({ page }) => {
  await page.goto("/top");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a","wcag2aa","wcag22aa"]).analyze();
  expect(r.violations.filter(v => ["serious","critical"].includes(v.impact!))).toEqual([]);
});
```

## Pitfalls
- Live-updating scores announced on every SSE patch → screen-reader spam. Never put scores in a live region.
- `div` click handlers for collapse/toggles; use `<button>`.
- Infinite scroll with no keyboard way to reach the footer/attribution. Prefer "More" pagination (30/page, like HN).
- Color-only kind badges (Ask/Show/Job) without text.

## Used by
- frontend-engineer
- ui-designer
- accessibility-specialist
- qa-test-engineer
