---
name: team-orchestration
description: Routes any question about the HN tech-news app to the right expert subagents, briefs them with self-contained prompts, runs them in parallel or in sequence, reconciles conflicting advice and synthesizes one combined answer. Use when asked to "ask the team", "consult the experts", "get the experts' opinion", "who should handle this", or for any cross-functional question (architecture + cost + legal, launch readiness, feature go/no-go) that spans more than one role.
metadata:
  id: S32
  used-by: [expert-orchestrator, product-owner]
  mvp: true
---
# Expert Team Orchestration

## Purpose
Turn one question into the smallest useful set of expert consultations, then into one decision-ready answer. The orchestrator does not answer domain questions from its own head when an expert exists; it routes, briefs, reconciles and synthesizes.

## When to use
- A question touches 2+ roles, or the right owner is unclear.
- Go/no-go and readiness reviews (MVP done? launch ready? enable AI summaries?).
- Conflicting recommendations already exist and need reconciling.

## Runtime notes (Claude Code)
- Experts are subagents in `.claude/agents/<name>.md`; invoke them with the **Agent** tool (`subagent_type: <name>`).
- Run the orchestrator as the **main thread** for best results: `claude --agent expert-orchestrator`. As the main thread it can spawn all experts; when itself running as a subagent, nesting is limited.
- Subagents can spawn subagents via the Agent tool, but only **up to a nesting depth limit**; keep the tree shallow (orchestrator → experts; experts rarely sub-delegate).
- Each subagent starts with a fresh context: it sees only its system prompt, preloaded skills and your brief. It does **not** see this conversation.
- Parallel = multiple Agent tool calls in the same message. Sequential = wait for results, then brief the next expert with them.

## Routing table
| Question type / keywords | Primary | Also consult |
|---|---|---|
| Scope, priority, MVP vs V2, acceptance criteria, "is it done" | product-owner | project-manager, qa-test-engineer |
| Backlog, sprint, status, blockers, timeline | project-manager | product-owner |
| Topics, "what counts as tech news", thresholds, watchlists | tech-news-editor | search-discovery-engineer, ai-ml-engineer |
| HN culture, Show HN, etiquette, ranking behaviour | hn-community-expert | community-manager, legal-counsel |
| User needs, personas, usability, "will people use X" | ux-researcher | growth-analytics-marketer, ui-designer |
| Architecture, stack, Netlify design, ADR, data flow | solution-architect | devops-netlify-engineer, performance-realtime-engineer |
| HN/Firebase API, Algolia proxy, feed cache, fan-out, null/dead items | hn-api-integration-engineer | solution-architect, qa-test-engineer |
| UI build, components, EventSource client, comment tree | frontend-engineer | ui-designer, accessibility-specialist |
| Visual design, tokens, dark mode, branding look | ui-designer | frontend-engineer, accessibility-specialist |
| Accessibility, WCAG, keyboard, screen reader, contrast | accessibility-specialist | frontend-engineer, qa-test-engineer |
| Search, ranking, velocity, trending, personalization | search-discovery-engineer | data-engineer, ai-ml-engineer |
| Storage, schema, Blobs vs Postgres/Supabase, snapshots, digests pipeline | data-engineer | solution-architect, privacy-compliance-officer |
| LLM, classification, AI summaries, prompts | ai-ml-engineer | finops-analyst, legal-counsel |
| Latency, Core Web Vitals, TTLs, SSE reconnects | performance-realtime-engineer | hn-api-integration-engineer, frontend-engineer |
| XSS, sanitization, CSP, secrets, dependency audit | security-engineer | qa-test-engineer, devops-netlify-engineer |
| Tests, fixtures, E2E, release gating, edge cases (docs/07) | qa-test-engineer | relevant engineer |
| CI, GitHub Actions, netlify.toml, deploys, previews, env vars, rollback | devops-netlify-engineer | sre-monitoring-engineer |
| Monitoring, alerts, Sentry, uptime, incidents, runbooks | sre-monitoring-engineer | devops-netlify-engineer |
| README, docs, user help | technical-writer | owner of the documented area |
| Cost, free tier, usage forecast, budget | finops-analyst | solution-architect, business-model-analyst |
| Monetization, pricing, unit economics | business-model-analyst | finops-analyst, product-marketing-strategist |
| Terms of Use, trademark, attribution, content licensing, HN/YC/Algolia terms | legal-counsel | hn-community-expert |
| Privacy policy, GDPR/CCPA, consent, email digests, accounts, retention | privacy-compliance-officer | legal-counsel, data-engineer |
| Positioning, naming, messaging, launch plan | product-marketing-strategist | community-manager, seo-content-marketer |
| Analytics, funnels, retention, A/B tests | growth-analytics-marketer | privacy-compliance-officer, ux-researcher |
| SEO, meta/OG tags, sitemap, blog/content | seo-content-marketer | frontend-engineer |
| Launch day, feedback triage, moderation | community-manager | hn-community-expert |
| New agent/skill, roster, CLAUDE.md wiring | agent-architect | technical-writer |
Default cap: **2–4 experts** per question. If an agent file doesn't exist yet (non-MVP role), fall back per docs/expert-roster.md "Who covers the rest in the MVP" (e.g. A11/A12/A14 → hn-api-integration-engineer + solution-architect; finance/legal/marketing → product-owner with a flag that a specialist is needed before launch).

## Parallel vs sequential
- **Parallel** when experts answer independent facets of the same question with the same inputs (e.g. "launch readiness": legal-counsel, privacy-compliance-officer, sre-monitoring-engineer, community-manager).
- **Sequential** when one expert's output is another's input (e.g. solution-architect proposes storage → finops-analyst costs it → privacy-compliance-officer reviews user-data parts).
- **Hybrid:** parallel first round, then one targeted follow-up to resolve a conflict.
- Avoid re-asking the same expert more than twice per question; escalate to the user instead.

## Briefing template (self-contained; the expert sees nothing else)
```text
Role check: You are being consulted as <agent-name> for the HN tech-news app (GitHub → Netlify).
Question: <one precise question>
Context you need: <facts, decisions already made (ADR ids), constraints: Netlify Functions/Scheduled
Functions/Blobs, Algolia 10k req/hr/IP, read-only HN API, attribution + no YC affiliation, privacy stance>
Relevant files: <paths, e.g. docs/06-algolia-search-api.md, netlify.toml>
Inputs from other experts (if sequential): <summary>
Deliverable: <format: recommendation + rationale + risks + open questions, ≤ 300 words / a table / a diff>
Out of scope: <what not to address>
Do not modify files unless asked; state assumptions explicitly.
```

## Reconciling conflicting advice
1. Restate each position in one line with its underlying goal (cost, speed, risk, UX).
2. Classify the conflict: factual (check docs/ or code), assumption-based (make the assumption explicit, ask user), or values trade-off.
3. Apply project priorities in order: **legal/privacy/security blockers > correctness (docs/07 edge cases) > user value in MVP scope > cost > elegance**.
4. Prefer the reversible option when evidence is equal; record irreversible ones as ADRs.
5. If still unresolved, present options with trade-offs and a recommended default; mark as an open question for the user/product-owner.
Never silently drop a dissenting expert's risk.

## Combined answer format
```markdown
## Summary
<2–4 sentences answering the question>
## Recommendation
<decision / next step, with confidence: high|medium|low>
## Expert contributions
- **<agent-name>:** <key point> (consulted in parallel|after <agent>)
- ...
## Conflicts & how they were resolved
## Risks
- <risk> → <mitigation> (owner)
## Open questions
- <question> → who decides
## Next actions
- [ ] <action> — <owner agent> — <issue/ADR link if any>
```

## Pitfalls
- Consulting everyone (slow, noisy); route narrowly.
- Briefs that say "see above" (subagents can't see it).
- Synthesizing by averaging instead of deciding.
- Skipping the legal/privacy disclaimer when legal-counsel or privacy-compliance-officer contribute: carry their "not legal advice; have a licensed attorney review" note into the combined answer.

## Used by
- expert-orchestrator
- product-owner
