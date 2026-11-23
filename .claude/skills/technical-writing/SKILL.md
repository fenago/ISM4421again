---
name: technical-writing
description: Writes and maintains the HN tech-news app's documentation, including README, setup/run docs, internal API reference for Netlify Functions, architecture notes and user help pages, plus agent/skill docs. Use when asked to "write the README", "document this endpoint", "update the docs", "write a user guide/FAQ", "explain how to run locally", or to review docs for accuracy and consistency with docs/ and CLAUDE.md.
metadata:
  id: S23
  used-by: [product-owner, solution-architect, technical-writer, agent-architect]
  mvp: false
---
# Technical Writing

## Purpose
Keep docs accurate enough that a new human or agent can clone the repo, run it, deploy a preview and understand the architecture without asking anyone.

## When to use
- New feature/Function/env var/config → docs change in the same PR.
- README, help/FAQ pages, API reference, ADR summaries, agent/skill docs.

## Doc map for this repo
| File | Audience | Owner |
|---|---|---|
| `README.md` | everyone: what, run, deploy | technical-writer |
| `docs/README.md` + `docs/01–10` | research context for agents | solution-architect |
| `docs/expert-roster.md`, `CLAUDE.md` | agent team | agent-architect |
| `docs/api.md` | internal Functions API | hn-api-integration-engineer |
| `docs/adr/NNNN-*.md` | decisions | solution-architect |
| `/about`, `/help` pages in app | readers | technical-writer + legal-counsel |

## README template
```markdown
# <AppName>
Live, topic-filtered tech news from Hacker News. Unofficial; not affiliated with Hacker News or Y Combinator.
Live site: <netlify URL> · Status: <badge>

## Features
## Quick start
  Prerequisites: Node <version>, Netlify CLI
  npm ci && npx netlify dev     # runs site + Functions locally
  npm test                      # fixtures only, no live HN calls
## Configuration
  | Env var | Required | Scope | Purpose |   (no secret values, ever)
## Architecture
  One diagram + link to docs/08 and ADRs.
## Data sources & attribution
  HN Firebase API, Algolia HN Search (10k req/hr/IP; we cache). Links back to HN + original URLs.
## Deploy
  PR → deploy preview; merge to main → production (Netlify).
## Contributing / License
```

## Function API reference template (`docs/api.md`)
```markdown
### GET /api/feeds/:name?page=1
Names: top|new|best|ask|show|job. 30 items/page.
Response 200: { generatedAt: ISO8601, page, items: Story[] }   Cache-Control: public, max-age=60
Errors: 404 unknown feed · 503 cache unavailable (serves last good if possible)
Example: curl https://<site>/api/feeds/top?page=1
```
Document every field of `Story`/`Comment` with type, nullability and source HN field (docs/03).

## Style rules
- Task-first headings ("Run locally"), imperative steps, one action per step.
- Show exact commands in code blocks; mark placeholders `<like-this>`.
- Prefer tables for env vars, endpoints, options.
- Times: say "Unix seconds" vs "ISO 8601" explicitly.
- Plain language for user help; no jargon like "N+1" there.
- Every page that shows HN data mentions attribution and non-affiliation.

## Procedure: docs change in a PR
1. Identify affected docs via the doc map.
2. Update in the same PR; include a "Docs" checklist item in the PR template.
3. Run the commands you document (or cite CI that does).
4. Check links (`npx markdown-link-check` or lychee in CI).
5. For agent docs, keep `CLAUDE.md`, `docs/expert-roster.md` and `.claude/team-spec.json` consistent (agent-skill-authoring).

## User help/FAQ starter questions
- Is this the official Hacker News? (No. Data from the public HN API.)
- Why can't I vote or comment here? (API is read-only; use "Discuss on HN".)
- How fresh is the data? ("Updated N min ago"; live new-story notices.)
- What data do you collect? (Link to privacy policy.)

## Pitfalls
- Docs drifting from `netlify.toml`/env vars; secrets pasted into examples.
- README claiming features that are V2.
- Outdated rate limits or endpoints; cite docs/06 and re-verify periodically.

## Used by
- product-owner
- solution-architect
- technical-writer
- agent-architect
