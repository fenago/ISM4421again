---
name: agile-project-management
description: Turns the HN tech-news app scope into a prioritized backlog, sprint plans and status reports for a team of expert agents shipping GitHub → Netlify. Use when asked to "plan the sprint", "build the backlog", "break this epic into stories", "write a status report", "what's blocking us", or to sequence MVP vs V2 work (feeds, live updates, search, digests, AI summaries).
metadata:
  id: S13
  used-by: [product-owner, project-manager]
  mvp: false
---
# Project Management / Agile

## Purpose
Keep a small, mostly-agent team shipping the HN tech-news app in short, demoable increments. Every increment ends as a merged PR to `main` and a Netlify production deploy (deploy previews on every PR).

## When to use
- Turning `docs/08-app-architecture.md` features and `docs/09-agent-team-briefing.md` "Definition of done" into a backlog.
- Planning a sprint / iteration, writing a status report, running a retro.
- Untangling dependencies between agents (e.g. frontend waiting on the feed-cache contract).

## Core knowledge
- **Cadence:** 1-week sprints suit this project (small scope, fast deploy previews). Demo = a Netlify deploy-preview URL.
- **Work item hierarchy:** Epic → User story → Task. Stories are vertical slices (Function + UI + test), not layers.
- **Backlog source of truth:** GitHub Issues + a GitHub Project board (columns: Backlog, Ready, In progress, In review, Done). Labels: `epic:*`, `agent:<name>`, `mvp`, `v2`, `blocked`, `decision-needed`.
- **Estimation:** T-shirt sizes (S ≤ ½ day, M ≤ 2 days, L = split it). Agents are fast at code, slow at unknowns: size by uncertainty, not keystrokes.
- **WIP limit:** max 1 in-progress story per agent; max 2 items "In review".

## Canonical epics for this app
| Epic | MVP? | Owner agents | Key dependency |
|---|---|---|---|
| E1 Repo, CI, Netlify site, deploy previews | MVP | devops-netlify-engineer | none (do first) |
| E2 HN client + Scheduled Function feed cache (Blobs) | MVP | hn-api-integration-engineer | E1 |
| E3 Feeds UI (Top/New/Best/Ask/Show/Jobs, 30/page) | MVP | frontend-engineer | E2 contract |
| E4 Live updates via EventSource + "N new stories" pill | MVP | frontend-engineer | E3 |
| E5 Story detail + sanitized lazy comment tree | MVP | frontend-engineer, hn-api-integration-engineer | E2 |
| E6 Algolia search proxy + search UI (cached, <10k req/hr/IP) | MVP | hn-api-integration-engineer, frontend-engineer | E1 |
| E7 Edge-case test suite (every item in docs/07) | MVP | qa-test-engineer | E2–E6 |
| E8 Topic filters / watchlists | V2 | tech-news-editor, search-discovery-engineer | E2 |
| E9 Velocity ranking & snapshots | V2 | data-engineer, search-discovery-engineer | storage decision |
| E10 Digests (email/push) | V2 | data-engineer, privacy-compliance-officer | accounts/privacy |
| E11 AI summaries | V2 | ai-ml-engineer, finops-analyst | budget decision |
| E12 Public launch (legal, privacy, Show HN) | Launch | legal-counsel, community-manager | all MVP |

## Procedure: build the backlog
1. List the open decisions from `docs/09` (platform, single vs multi-user, hosting, topics, digests, AI). Create one `decision-needed` issue each; link the ADR when resolved.
2. Create the epics above as issues; tag `mvp`/`v2`.
3. Split each MVP epic into stories using the template below. Each story must be independently deployable behind the deploy preview.
4. Order: E1 → E2 contract stub (fixtures) → E3/E5/E6 in parallel → E4 → E7 hardening.
5. Mark cross-agent contracts (e.g. `GET /api/feeds/:name?page` JSON shape) as their own S-sized stories, done first, so consumers can build against fixtures.

## User story template
```markdown
### Story: <verb> <thing> so that <value>
As a <reader persona>, I want <capability>, so that <outcome>.
**Acceptance criteria**
- [ ] Given <state>, when <action>, then <result>  (cite docs/07 edge case if relevant)
- [ ] Works on the Netlify deploy preview
- [ ] Tests: unit/fixture (+ E2E if UI); no live HN calls in CI
- [ ] Attribution: links to HN discussion + original URL where stories are shown
**Owner agent:** <name>  **Size:** S/M  **Depends on:** #<issue>
```

## Sprint planning checklist
- [ ] Sprint goal in one sentence (e.g. "Readers can browse all six feeds on a deploy preview").
- [ ] Capacity: which agents are active this sprint (MVP team = 6).
- [ ] Every pulled story is "Ready": acceptance criteria, owner, size, deps resolved.
- [ ] At least one hardening/test story per sprint.
- [ ] Risks noted (e.g. sandbox blocks `hacker-news.firebaseio.com` → use fixtures).

## Status report template (weekly)
```markdown
## Status — Sprint <n> (<dates>)  RAG: Green|Amber|Red
**Goal:** ...   **Deploy:** <netlify prod URL> / <preview URL>
**Done:** #12 Feeds UI, #14 Algolia proxy
**In progress:** #15 Live updates (frontend-engineer, 60%)
**Blocked:** #18 needs decision on storage (Blobs vs Supabase) → solution-architect by <date>
**Metrics:** stories done N/M, open bugs, CI pass rate, Algolia req/hr peak
**Risks / asks:** ...
**Next sprint:** ...
```

## Retro format
Keep / Drop / Try, max 3 each, one owner per "Try".

## Pitfalls
- Horizontal stories ("build all Functions") delay demoable value. Slice vertically.
- Letting V2 (digests, AI) creep into MVP before accounts/privacy decisions are made.
- Unresolved contracts between agents: always stub with recorded fixtures first.
- Planning live-API work in a sandbox that blocks HN hosts; plan fixture-first.

## Used by
- product-owner
- project-manager
