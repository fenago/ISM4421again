---
name: search-ranking-relevance
description: Designs ranking and relevance for the HN tech-news app, covering velocity/trending scores from snapshots, topic-feed ordering, personalization boosts and Algolia query tuning within 10k req/hr/IP. Use when asked to "rank stories", "build a trending/rising feed", "compute velocity", "personalize the feed", "tune search results", "why is this story ranked here", or to evaluate ranking changes.
metadata:
  id: S20
  used-by: [search-discovery-engineer, data-engineer, ai-ml-engineer]
  mvp: false
---
# Search Ranking & Relevance

## Purpose
Decide what appears first in each surface: preserve HN's order where HN is the source of truth, and add our own transparent ranking only for topic feeds, "rising", digests and search.

## When to use
- Building Rising/Trending, topic feeds, digest ordering, personalized views.
- Tuning Algolia queries or debugging "why is X above Y".

## Surface → ranking rule
| Surface | Ranking | Source |
|---|---|---|
| Top / Best / New / Ask / Show / Jobs | **HN's order, unchanged** | Firebase list endpoints |
| Rising | velocity (below) among stories < 6 h old | our snapshots |
| Topic feed | gravity score (below) filtered by topic | stories table / Algolia |
| Search "relevance" tab | Algolia `/search` (relevance → points → comments) | Algolia |
| Search "newest" tab | Algolia `/search_by_date` | Algolia |
| Digest | peak score in window, max 3 per topic, dedupe by domain | snapshots |

## Formulas
- **Velocity** (pts/hr) over the last window: `v = (score_now - score_then) / hours_between`, window 30–60 min, require ≥ 2 snapshots; ignore stories with score < 5 to avoid noise.
- **Gravity score** for topic feeds (HN-like, public folklore approximation; not HN's actual algorithm):
  `rank = (points - 1) / (age_hours + 2) ^ 1.8`, with optional `+ 0.5 * log10(1 + comments)`.
- **Personal boost** (only with explicit user topics): `final = rank * (1 + 0.3 * matched_topics) * (hidden_domain ? 0 : 1)`. Keep boosts bounded so personalization never buries a #1 HN story.
Make all constants config, not code; record changes in an ADR.

## Algolia query tuning (see docs/06)
- Topic feed backing query: `/search_by_date?query=<terms>&tags=story&numericFilters=created_at_i>{now-86400},points>20&hitsPerPage=50`.
- Use `restrictSearchableAttributes=url` for domain queries (`github.com`).
- OR tags with parentheses: `tags=story,(show_hn,ask_hn)`.
- `objectID` is a string → `Number()` before joining with Firebase ids. Algolia can lag Firebase by minutes: overlay fresh score/comments from our cache when available.
- **Budget:** 10,000 req/hr per IP, and Netlify Functions may share egress IPs. Cache normalized results in Blobs (2–10 min TTL by query popularity), debounce UI to 300 ms, minimum 2 chars, coalesce identical in-flight queries. Alert at 50% of budget.

## Evaluation procedure
1. Build a judged set: 30 queries/topics × top 10 results, label relevant (2), partial (1), irrelevant (0).
2. Compute NDCG@10 and precision@10 before/after; require no regression > 2%.
3. For Rising: backtest on stored snapshots. Did stories reach top 30 within 2 h? Report hit rate and median lead time.
4. Spot-check for gaming signals (single domain dominating, flagged content).
5. Ship behind a config flag; compare click-through via web-analytics-experimentation (privacy-friendly).

## Explainability
Expose a debug field (dev only) `rankReason: { base, velocity, boosts }` so "why is this here" is answerable. Never claim our order is HN's order on non-HN surfaces; label as "Rising (by points/hour)".

## Pitfalls
- Re-ranking HN's own Top list (confuses readers, misrepresents HN).
- Velocity from a single snapshot or across a cache gap → spikes.
- Personalization filter bubbles: always allow "show all".
- Hitting Algolia per keystroke; forgetting per-IP limit applies to shared Function IPs.
- Dead/deleted items surviving in cached ranked lists. Filter after fetch, then backfill.

## Used by
- search-discovery-engineer
- data-engineer
- ai-ml-engineer
