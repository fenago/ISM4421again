---
name: web-analytics-experimentation
description: Sets up privacy-friendly analytics, event taxonomy, funnels, retention metrics and A/B tests for the HN tech-news app on Netlify without third-party trackers. Use when asked to "add analytics", "what should we measure", "define the north-star metric", "build a funnel", "measure retention", "run an A/B test", "is this result significant", or to review an event plan for privacy.
metadata:
  id: S29
  used-by: [ux-researcher, growth-analytics-marketer, seo-content-marketer]
  mvp: false
---
# Web Analytics & Experimentation

## Purpose
Measure whether readers find value (and come back) using the least data necessary, and test changes rigorously enough to avoid fooling ourselves.

## When to use
- Choosing an analytics tool; defining events/KPIs; launch reporting; experiments.

## Tool decision
| Option | Use when |
|---|---|
| Cookieless aggregate analytics (Plausible, Fathom, Simple Analytics, Netlify server-side analytics) | Default: page views, referrers, custom events, no personal identifiers |
| Self-hosted (Umami, Plausible CE) | Want full data control |
| Product analytics with user IDs (PostHog etc.) | Only with accounts and a privacy review; disable session replay by default |
| Google Analytics / ad pixels | Avoid; conflicts with privacy stance and HN audience expectations |
Any choice → update the data inventory and privacy policy (privacy-data-protection).

## Metrics
- **North star:** weekly returning readers who open ≥ 3 stories (proxy for "kept up with tech news").
- Activation: first visit → opened a story or HN discussion within session.
- Engagement: stories opened/visit, discussions opened/visit, live pill clicks, searches/visit, topic filter usage.
- Retention: D1/D7/D30 returning visitors (aggregate, cookieless tools estimate via daily hashes; label as approximate).
- Quality/ops: feed freshness, search zero-result rate, error rate (observability).
- Launch: Show HN referrals, landing → feed CTR, GitHub stars.

## Event taxonomy (object_action, snake_case, no PII)
| Event | Props (allowed) |
|---|---|
| `story_open` | `feed`, `rank_bucket` (1–10/11–30/31+), `kind` |
| `discussion_open` | `feed`, `target` (`our_view`/`hn`) |
| `live_pill_click` | `new_count_bucket` |
| `search_submit` | `has_filters`, `results_bucket` (0/1–10/10+) — **never the query text** |
| `topic_toggle` | `topic`, `state` |
| `theme_change` | `theme` |
| `digest_signup_start` / `_confirmed` | none |
Forbidden props: emails, free text, full URLs with query strings, HN usernames of the reader.

## Funnels
1. Landing → feed view → story_open (activation).
2. Story view → discussion_open → return visit within 7 d.
3. Digest: signup_start → confirmed → first email opened (if tracked at all; prefer aggregate provider stats).

## A/B testing procedure
1. Hypothesis: "Showing the live pill instead of auto-insert increases story_open/visit by ≥ 5%."
2. Primary metric + guardrails (error rate, bounce, a11y).
3. Assignment without tracking cookies: Netlify split testing (branch-based) or edge-side random bucket stored in `localStorage` only; disclose in privacy policy if needed.
4. Sample size: use a power calculator (α=0.05, power=0.8). Small sites often can't detect < 10% effects; prefer qualitative tests then.
5. Fix duration up front (≥ 1–2 full weeks, include weekdays); no peeking-driven stops.
6. Analyze: difference + confidence interval; report "no detectable difference" honestly.
7. Record in `docs/experiments/NNN-<slug>.md`: hypothesis, setup, dates, result, decision.

## Reporting template (weekly)
```markdown
Week of <date>: visitors <n> (Δ%), returning <n>, stories opened/visit <x>, discussions/visit <x>,
searches <n> (zero-result <x%>), top referrers, top topics, notable events (launch, outages).
Insights → actions (owner).
```

## Pitfalls
- Tracking search queries (can contain personal info) → don't.
- Over-instrumenting before there are users.
- Treating Show HN spike traffic as baseline.
- Calling winners on tiny samples.

## Used by
- ux-researcher
- growth-analytics-marketer
- seo-content-marketer
