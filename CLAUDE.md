# CLAUDE.md: HN Tech-News App and Expert Agent Team

This repo is for building a **tech-news app on the Hacker News API**, deployed **GitHub → Netlify**, by a team of Claude Code expert subagents.

## Where things live
| Path | What |
|---|---|
| `docs/` | Research on the HN API, Algolia, realtime updates, architecture and the agent-team brief. **Start at `docs/README.md`.** |
| `docs/expert-roster.md` | The human-readable roster: 27 experts, skills matrix, MVP team |
| `.claude/agents/*.md` | 29 project subagents (27 roster experts + orchestrator + meta) |
| `.claude/skills/<name>/SKILL.md` | 33 project skills, preloaded into agents via each agent's `skills:` list |
| `knowledge/<agent-name>/` | Per-agent knowledge folder. Each agent reads its folder **before every answer**. Drop in project docs to teach that agent |
| `docs/agent-brains.md` | Each agent's model (opus/sonnet/haiku), why, and its persona (name, voice, working style) |
| `.claude/team-spec.json` | **Source of truth** for agent ↔ skill wiring (keep it in sync) |

## How to use the team
- **Ask anything, get one combined answer:** use the orchestrator. It picks the experts, runs them (in parallel where it can), resolves conflicts and returns one answer.
  - In a session: `@agent-expert-orchestrator Should we support email digests in the MVP?`
  - Or make it the main thread (best, since it can then fan out to experts freely):

    ```bash
    claude --agent expert-orchestrator
    ```
- **Ask one expert directly:** `@agent-legal-counsel review our attribution plan`, or "Use the qa-test-engineer subagent to…".
- **Change the team:** `@agent-agent-architect add a "mobile-engineer" agent with skills X, Y`, or "improve the seo-content-marketer prompt". It updates files, `team-spec.json`, this file and the roster, then validates the wiring.
- **Use a skill directly:** `/hn-api-knowledge`, `/netlify-platform`, and so on (all skills are user-invocable).

⭐ = **minimum viable team.** Start with these 6 (+ orchestrator) for the MVP build. Others join per the hiring order in `docs/expert-roster.md`.

## Team (29 agents)
| ⭐ | Agent | ID | Dept | Job |
|---|---|---|---|---|
| ⭐ | `product-owner` | A01 | Leadership | Owns the vision, MVP scope, priorities and acceptance criteria, and coordinates all other agents. |
|  | `project-manager` | A02 | Leadership | Turns scope into a backlog and sprints, tracks progress, and removes blockers between agents. |
|  | `tech-news-editor` | A03 | Business | Defines the topic taxonomy, signal thresholds and what "relevant tech news" means for the user. |
|  | `hn-community-expert` | A04 | Business | Advises on HN culture, etiquette, ranking behaviour and how to launch to the HN audience without backlash. |
|  | `ux-researcher` | A05 | Business | Interviews target readers, maps reading habits and validates features (feeds, digests, filters). |
| ⭐ | `solution-architect` | A06 | Technical | Designs the Netlify-native architecture, data flow, caching and module contracts, and makes the stack decisions. |
| ⭐ | `hn-api-integration-engineer` | A07 | Technical | Builds the HN client (fan-out, retries, normalization, `null`/dead handling), the Scheduled Function feed cache and the Algolia search proxy. |
| ⭐ | `frontend-engineer` | A08 | Technical | Builds the responsive UI: feeds, story and comment views, live "new stories" updates via EventSource, and safe HTML rendering. |
|  | `ui-designer` | A09 | Technical | Creates the design system, layouts, dark/light themes and brand look. |
|  | `accessibility-specialist` | A10 | Technical | Ensures WCAG 2.2 AA: keyboard navigation, screen readers, contrast. |
|  | `search-discovery-engineer` | A11 | Technical | Owns Algolia queries, topic feeds, ranking/velocity scoring and rate-limit-aware caching. |
|  | `data-engineer` | A12 | Technical | Designs storage (Blobs, Supabase or Postgres), history snapshots, and digest and trend pipelines. |
|  | `ai-ml-engineer` | A13 | Technical | Builds topic classification and optional LLM summaries of stories and discussions. |
|  | `performance-realtime-engineer` | A14 | Technical | Tunes concurrency, caching TTLs, Core Web Vitals, and stream reconnect/fallback behaviour. |
|  | `security-engineer` | A15 | Technical | Covers HTML sanitization/XSS, CSP headers, dependency audits and secrets handling in Netlify. |
| ⭐ | `qa-test-engineer` | A16 | Technical | Writes the unit, fixture, contract and end-to-end tests covering every edge case in [07](07-gotchas-and-edge-cases.md), and gates releases. |
| ⭐ | `devops-netlify-engineer` | A17 | Operations | Owns the GitHub repo workflow, CI (GitHub Actions), `netlify.toml`, deploy previews, env vars, domains and rollbacks. |
|  | `sre-monitoring-engineer` | A18 | Operations | Sets up uptime checks, function logs, error tracking (e.g. Sentry), alerts and incident runbooks. |
|  | `technical-writer` | A19 | Operations | Maintains the README, setup and run docs, architecture docs and user help pages. |
|  | `finops-analyst` | A20 | Finance | Forecasts and monitors Netlify, Algolia, DB and LLM costs, and sets budgets and usage alerts. |
|  | `business-model-analyst` | A21 | Finance | Evaluates free, freemium, sponsorship or premium-digest models and pricing. |
|  | `legal-counsel` | A22 | Legal | Reviews HN/Y Combinator and Algolia usage terms, attribution, trademark (no implied YC affiliation), and drafts the app's Terms of Use. |
|  | `privacy-compliance-officer` | A23 | Legal | Drafts the privacy policy and cookie/analytics consent, and covers GDPR/CCPA for any accounts or email digests. |
|  | `product-marketing-strategist` | A24 | Marketing | Defines positioning, naming, messaging and the launch plan. |
|  | `growth-analytics-marketer` | A25 | Marketing | Sets up privacy-friendly analytics, funnels, retention metrics and A/B tests. |
|  | `seo-content-marketer` | A26 | Marketing | Covers SEO for the Netlify site, landing page copy, blog content and social posts. |
|  | `community-manager` | A27 | Marketing | Runs the Show HN launch, user feedback channels and the feature-request loop. |
| ⭐ | `expert-orchestrator` | X01 | Team | Takes any question, decides which experts to consult, runs them (in parallel where independent), reconciles their input and returns one combined answer. |
|  | `agent-architect` | X02 | Team | Creates new agents and skills and improves existing ones, keeping the roster, wiring and CLAUDE.md consistent. |

## Skills (33) and who uses them
| ⭐ | Skill | ID | Used by |
|---|---|---|---|
| ⭐ | `hn-api-knowledge` | S01 | `product-owner`, `tech-news-editor`, `hn-community-expert`, `solution-architect`, `hn-api-integration-engineer`, `frontend-engineer`, `search-discovery-engineer`, `data-engineer`, `ai-ml-engineer`, `qa-test-engineer`, `expert-orchestrator` |
| ⭐ | `algolia-hn-search` | S02 | `solution-architect`, `hn-api-integration-engineer`, `search-discovery-engineer`, `data-engineer`, `qa-test-engineer` |
| ⭐ | `realtime-streaming-sse` | S03 | `solution-architect`, `hn-api-integration-engineer`, `frontend-engineer`, `performance-realtime-engineer`, `qa-test-engineer` |
| ⭐ | `typescript-engineering` | S04 | `solution-architect`, `hn-api-integration-engineer`, `frontend-engineer`, `search-discovery-engineer`, `data-engineer`, `ai-ml-engineer`, `performance-realtime-engineer`, `security-engineer`, `qa-test-engineer` |
| ⭐ | `frontend-framework` | S05 | `solution-architect`, `frontend-engineer`, `ui-designer`, `accessibility-specialist`, `performance-realtime-engineer` |
| ⭐ | `netlify-platform` | S06 | `solution-architect`, `hn-api-integration-engineer`, `search-discovery-engineer`, `performance-realtime-engineer`, `security-engineer`, `devops-netlify-engineer`, `sre-monitoring-engineer`, `finops-analyst` |
| ⭐ | `git-github-ci` | S07 | `product-owner`, `project-manager`, `solution-architect`, `hn-api-integration-engineer`, `frontend-engineer`, `qa-test-engineer`, `devops-netlify-engineer`, `technical-writer` |
| ⭐ | `caching-performance` | S08 | `solution-architect`, `hn-api-integration-engineer`, `search-discovery-engineer`, `performance-realtime-engineer`, `devops-netlify-engineer` |
| ⭐ | `html-sanitization-web-security` | S09 | `hn-api-integration-engineer`, `frontend-engineer`, `security-engineer`, `qa-test-engineer` |
| ⭐ | `software-testing` | S10 | `hn-api-integration-engineer`, `frontend-engineer`, `performance-realtime-engineer`, `security-engineer`, `qa-test-engineer` |
| ⭐ | `requirements-acceptance-criteria` | S11 | `product-owner`, `project-manager`, `ux-researcher`, `solution-architect`, `qa-test-engineer`, `expert-orchestrator` |
| ⭐ | `architecture-decision-records` | S12 | `product-owner`, `solution-architect`, `data-engineer`, `performance-realtime-engineer`, `security-engineer`, `expert-orchestrator` |
|  | `agile-project-management` | S13 | `product-owner`, `project-manager` |
|  | `tech-news-taxonomy` | S14 | `tech-news-editor`, `hn-community-expert`, `search-discovery-engineer`, `ai-ml-engineer`, `product-marketing-strategist`, `seo-content-marketer` |
|  | `hn-community-norms` | S15 | `hn-community-expert`, `legal-counsel`, `product-marketing-strategist`, `community-manager` |
|  | `ux-research` | S16 | `ux-researcher`, `frontend-engineer`, `ui-designer`, `accessibility-specialist` |
|  | `ui-design-system` | S17 | `frontend-engineer`, `ui-designer`, `accessibility-specialist`, `product-marketing-strategist` |
|  | `accessibility-wcag` | S18 | `frontend-engineer`, `ui-designer`, `accessibility-specialist`, `qa-test-engineer` |
|  | `data-modeling-storage` | S19 | `solution-architect`, `hn-api-integration-engineer`, `data-engineer`, `ai-ml-engineer` |
|  | `search-ranking-relevance` | S20 | `search-discovery-engineer`, `data-engineer`, `ai-ml-engineer` |
|  | `llm-nlp-integration` | S21 | `search-discovery-engineer`, `ai-ml-engineer`, `finops-analyst` |
|  | `observability-incident-response` | S22 | `performance-realtime-engineer`, `security-engineer`, `devops-netlify-engineer`, `sre-monitoring-engineer` |
|  | `technical-writing` | S23 | `product-owner`, `solution-architect`, `technical-writer`, `agent-architect` |
|  | `finops-cost-modeling` | S24 | `solution-architect`, `devops-netlify-engineer`, `finops-analyst`, `business-model-analyst` |
|  | `business-model-pricing` | S25 | `product-owner`, `finops-analyst`, `business-model-analyst`, `product-marketing-strategist` |
|  | `legal-terms-ip-attribution` | S26 | `hn-community-expert`, `legal-counsel` |
|  | `privacy-data-protection` | S27 | `data-engineer`, `legal-counsel`, `privacy-compliance-officer`, `growth-analytics-marketer` |
|  | `product-marketing-positioning` | S28 | `product-owner`, `product-marketing-strategist`, `seo-content-marketer`, `community-manager` |
|  | `web-analytics-experimentation` | S29 | `ux-researcher`, `growth-analytics-marketer`, `seo-content-marketer` |
|  | `seo-content-marketing` | S30 | `frontend-engineer`, `product-marketing-strategist`, `seo-content-marketer` |
|  | `community-management` | S31 | `hn-community-expert`, `product-marketing-strategist`, `community-manager` |
| ⭐ | `team-orchestration` | S32 | `expert-orchestrator`, `product-owner` |
|  | `agent-skill-authoring` | S33 | `agent-architect` |

## Key project facts (all agents)
- HN API: `https://hacker-news.firebaseio.com/v0/`. Read-only, no auth, lists return **IDs only** (N+1 fan-out), items can be `null`/`deleted`/`dead`, text is **HTML** (sanitize), times are **Unix seconds**. See `docs/02`, `docs/03`, `docs/07`.
- Search and history: Algolia `https://hn.algolia.com/api/v1` (10k req/hr/IP). Proxy and cache it. See `docs/06`.
- Netlify architecture: static frontend on the CDN. A **Scheduled Function** caches feeds into **Netlify Blobs**. An **Algolia proxy Function** handles search. The browser uses **EventSource directly to Firebase** for live updates. No long-lived servers on Netlify.
- Always attribute HN (link `https://news.ycombinator.com/item?id=<id>`) and the original URL. Don't imply Y Combinator affiliation.
- This cloud sandbox blocks `hacker-news.firebaseio.com` and `hn.algolia.com`. Use recorded fixtures in tests, or allow-list those hosts in the environment.

## Brains and personas
Each agent has a `model:` (opus for strategy, legal and finance judgment; sonnet for specialist work; haiku for fast lookups) and a persona with a first name, voice and working style. See `docs/agent-brains.md`.

## Working rules
- Develop on feature branches. QA (`qa-test-engineer`) gates merges. A merge to `main` triggers the Netlify production deploy.
- Never commit secrets. Netlify env vars hold any keys (none are needed for HN/Algolia).
- Keep `docs/`, `.claude/team-spec.json`, this file and the agent/skill files consistent. `agent-architect` owns that.
- New agents must get a `knowledge/<name>/README.md`, a persona, a `model:` and the "read knowledge folder first" section. `agent-architect` enforces this.
