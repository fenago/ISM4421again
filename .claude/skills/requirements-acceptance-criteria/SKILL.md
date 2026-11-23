---
name: requirements-acceptance-criteria
description: Turns the HN tech-news app vision into testable requirements - user stories in a fixed format, Given/When/Then acceptance criteria, MVP vs V2 scoping, the MVP definition of done from docs/09, non-functional targets, and the open decisions that block work. Use when writing or refining user stories, splitting epics, scoping MVP, defining "done", reviewing whether a PR meets its criteria, or deciding what is out of scope.
metadata:
  id: S11
  used-by: [product-owner, project-manager, ux-researcher, solution-architect, qa-test-engineer, expert-orchestrator]
  mvp: true
---
# Requirements & Acceptance Criteria

## Purpose
Give every agent the same, testable definition of what to build and when it's done. Sources: [08-app-architecture](../../../docs/08-app-architecture.md) (features, NFRs), [09-agent-team-briefing](../../../docs/09-agent-team-briefing.md) (definition of done, open decisions).

## When to use
Writing stories/issues, scoping a release, reviewing a PR against its story, or settling "is this in MVP?".

## Persona
**Dr. Lee** - wants continuously updated, low-noise tech news from HN, with live updates, search and (later) topic filtering. Single user first; multi-user is an open decision.

## Scope
| MVP | V2 | Out of scope (API can't) |
|---|---|---|
| Top/New/Best/Ask/Show/Jobs tabs, 30/page | Topic filters / watchlists | Voting, commenting, submitting, login to HN |
| Live "N new stories" without reload | Signal threshold (points, comments, velocity) | Comment scores |
| Story view + lazy sanitized comments | Daily/weekly digests (needs history) | Exact historical front pages (only via Algolia approximation) |
| Keyword search via Algolia (cached) | Read/unread, bookmarks, hide domains | |
| | AI summaries (LLM) | |

## Open decisions (resolve before dependent stories start; record as ADRs)
1. Web/PWA only, or native mobile too?
2. Single-user or multi-user (accounts, per-user topics)?
3. Hosting: always-on SSE worker vs **serverless cron polling** (Netlify implies cron + browser EventSource).
4. Initial topic watchlist.
5. Digests in MVP or V2?
6. AI summaries in scope? Model/provider and budget.

## Story format
```markdown
### US-<nn>: <short title>
As Dr. Lee, I want <capability> so that <benefit>.
Priority: MVP | V2   Estimate: S/M/L   Depends on: US-xx, ADR-xxxx
Acceptance criteria:
- Given <context>, when <action>, then <observable result>.
Edge cases (docs/07): <list>
Out of scope: <list>
```
INVEST check: Independent, Negotiable, Valuable, Estimable, Small (fits one PR < ~400 lines), Testable.

## MVP stories with acceptance criteria
**US-01 Browse feeds**
- Given the Top tab, when the page loads, then 30 stories render in HN rank order showing rank, title, domain, points, comment count, age and author.
- Given a job in `/topstories`, then it shows a "Job" label (or is hidden, per ADR).
- Given dead/deleted IDs in the list, then they are omitted and the page still shows 30 items.
- Given I go to page 2, then no story from page 1 reappears (snapshot ID list).

**US-02 Live updates**
- Given I'm on Top, when a new story enters the top 30 on HN, then within 60 s a "N new stories" control appears without the list reordering.
- When I activate it, then the list updates and focus/announcement is accessible (`aria-live`).
- Given the live stream is blocked, then the feed still refreshes via polling within 60 s.

**US-03 Story & comments**
- Given a story, then I can open the original URL and the HN discussion (`news.ycombinator.com/item?id=`).
- Given comments, then top-level comments load first and replies load on expand, in HN order.
- Given deleted/dead comments with replies, then a placeholder keeps the replies visible.
- Given HTML in comments, then it's sanitized (no script execution; links open safely).

**US-04 Search**
- Given I search "rust", then results from Algolia show within 1 s (cached) with the same row format.
- Given a newest-first toggle, then `/search_by_date` ordering is used.
- Given Algolia is rate-limited, then I see cached results or a friendly retry message.

## Non-functional requirements
- Feed API p95 < 200 ms from cache; new top story in client < 60 s after HN.
- Ingest resilient to HN errors (stale > empty); polling fallback for live updates.
- All rendered HTML sanitized; no secrets required.
- WCAG 2.2 AA: keyboard navigation, readable dark/light themes.
- Attribution: link to the HN discussion and original URL on every story.

## Definition of done (MVP release)
- [ ] Top/New/Best/Ask/Show/Jobs render 30/page in HN order, jobs labeled.
- [ ] New top stories appear within 60 s without reload.
- [ ] Story view: sanitized, lazy-loaded comment tree; handles deleted/dead.
- [ ] Keyword search works via Algolia, cached.
- [ ] Every edge case in [07](../../../docs/07-gotchas-and-edge-cases.md) has a test.
- [ ] README with run instructions; no secrets required.
- [ ] Deployed to Netlify production from `main`; deploy preview verified by QA.

## Definition of done (per story / PR)
- [ ] All acceptance criteria demonstrably met on the deploy preview.
- [ ] Tests added (unit/fixture + E2E where user-visible); CI green.
- [ ] No new a11y violations (axe); no high `npm audit` findings.
- [ ] Docs/ADR updated if behavior or architecture changed.

## Pitfalls
- Criteria that aren't observable ("works well", "fast") - give numbers or visible outcomes.
- Stories that assume API capabilities that don't exist (search, writes, comment scores).
- Pulling V2 (digests, topics) into MVP without resolving storage decisions first.

## Used by
product-owner, project-manager, ux-researcher, solution-architect, qa-test-engineer, expert-orchestrator
