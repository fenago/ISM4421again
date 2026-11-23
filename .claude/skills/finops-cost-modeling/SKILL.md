---
name: finops-cost-modeling
description: Forecasts and controls running costs for the HN tech-news app, covering Netlify plan usage (bandwidth, Function invocations, Scheduled Function runs, Blobs), Algolia request budget, database and LLM spend, with budgets and alerts. Use when asked "what will this cost", "will we exceed the free tier", "forecast usage at N users", "set a budget/alert", "is AI summarization affordable", or to compare hosting/storage options on cost.
metadata:
  id: S24
  used-by: [solution-architect, devops-netlify-engineer, finops-analyst, business-model-analyst]
  mvp: false
---
# Cost Modeling & FinOps

## Purpose
Keep the app cheap (ideally free-tier for a personal/early product) and predictable as traffic grows, by modelling usage drivers and putting caps and alerts in place before a Show HN spike.

## When to use
- Architecture and storage decisions (cost is an ADR criterion).
- Before enabling V2 features (snapshots, digests, AI summaries).
- Before launch (traffic spike scenario) and monthly reviews.

## Cost drivers for this app
| Component | Driver | Notes |
|---|---|---|
| Netlify bandwidth/CDN | page views × page weight | Static assets cached at CDN; keep JS small |
| Netlify Functions | API requests not served from CDN cache | `Cache-Control`/`Netlify-CDN-Cache-Control` on `/api/feeds/*` cuts invocations drastically |
| Scheduled Functions | runs/day × duration | every 1 min = 1,440 runs/day; every 5 min = 288 |
| Netlify Blobs | storage + operations | small JSON blobs; reads per Function call |
| Algolia HN API | free, but **10k req/hr/IP** | budget, not money; exceeding risks a block |
| HN Firebase API | free, no documented limit | be polite; traffic ∝ change, not users |
| Postgres (Supabase/Neon) | storage (snapshots!), compute | free tiers may pause on inactivity |
| Email (digests) | emails/month | provider free tier limits |
| LLM | tokens | see llm-nlp-integration formula |
| Error tracking / uptime | events, monitors | free tiers usually enough early |
Always check **current** vendor pricing pages; plans and limits change. Record the date checked in the model.

## Forecast template
```markdown
## Cost model — <date>, prices checked <date>
Assumptions: DAU=<n>, pages/visit=<n>, page weight=<KB>, API calls/page=<n>,
CDN hit ratio for /api=<%>, scheduled interval=<min>, stories/day≈1,000, AI eligible=<%>
| Line item | Formula | Monthly qty | Plan included | Overage | $ |
| Bandwidth | DAU×30×pages×KB | | | | |
| Function invocations | DAU×30×pages×calls×(1−hit%) + scheduled runs | | | | |
| Algolia req/hr peak | searches/hr after cache | | 10,000/IP | n/a | — |
| DB storage | snapshot rows × bytes | | | | |
| LLM | see S21 | | | | |
Scenarios: Base, Show HN spike (e.g. 20–50k visitors in 24 h), 10× growth.
```

## Worked sanity check (example numbers, adjust)
- Scheduled builder every 2 min: 720 runs/day ≈ 21.6k runs/month, each fetching ~6 lists + changed items.
- 1,000 DAU × 5 pages × 2 API calls = 10k calls/day; with 90% CDN hit only ~1k Function invocations/day.
- Search: 1,000 DAU × 2 searches = 2k/day ≈ 83/hr average; peak 10× = 830/hr → fine vs 10k if cached and debounced.

## Controls checklist
- [ ] CDN caching on feed endpoints (`s-maxage=60, stale-while-revalidate=300`).
- [ ] Spend limits / usage alerts in Netlify, DB, email and LLM dashboards (alert at 50/80/100%).
- [ ] Kill-switch env vars for expensive features (`AI_SUMMARIES_ENABLED`, `SNAPSHOTS_ENABLED`).
- [ ] Snapshot retention/downsampling (data-modeling-storage).
- [ ] Bot protection/rate limiting on `/api/search` to protect the Algolia budget.
- [ ] Monthly review issue: actual vs forecast, top 3 drivers, actions.

## Decision rules
- Prefer cron interval of 2–5 min unless the live path (browser EventSource) is insufficient; freshness beyond 60 s comes from the client stream, not more cron runs.
- Add Postgres only when a V2 feature needs it; Blobs-only MVP has near-zero marginal cost.
- LLM features need a written monthly cap before enabling.

## Pitfalls
- Uncached `/api` routes → Function invocations scale with users.
- 1-minute cron "just because".
- Forgetting deploy-preview builds consume build minutes.
- Treating Algolia's limit as soft; it's per IP and Function IPs may be shared.

## Used by
- solution-architect
- devops-netlify-engineer
- finops-analyst
- business-model-analyst
