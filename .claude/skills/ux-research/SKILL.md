---
name: ux-research
description: Plans and runs lightweight UX research for the HN tech-news reader, covering interviews, personas, usability tests and synthesis into backlog changes. Use when asked to "validate this feature", "write an interview guide", "run a usability test", "create personas", "should we build digests/topic filters", or to turn reader feedback into prioritized insights.
metadata:
  id: S16
  used-by: [ux-researcher, frontend-engineer, ui-designer, accessibility-specialist]
  mvp: false
---
# UX Research & Usability Testing

## Purpose
Validate that the app actually helps people keep up with tech news with less noise than news.ycombinator.com itself, before investing in V2 features (topics, digests, AI summaries).

## When to use
- Before committing to a V2 epic (topic filters, digests, accounts, summaries).
- After an MVP deploy preview exists, to test feeds, live-update pill, story/comment view, search.
- When analytics show drop-off you can't explain.

## Core knowledge
- 5 participants per round find most usability issues; run small rounds often.
- Research question → method: "what do people need?" = interviews; "can they use it?" = usability test; "how many?" = analytics/survey (see web-analytics-experimentation).
- Our readers already have a strong mental model: HN's own dense list. Deviations (cards, images, infinite scroll) must earn their place.

## Provisional personas (validate, don't trust)
| Persona | Context | Need | Risk for us |
|---|---|---|---|
| Busy practitioner | Checks HN 2–3×/day on phone | "Don't miss big stories in my areas" → topic filters, digest | Noise, slow mobile load |
| HN power reader | Lives in comments | Fast threads, collapse, keyboard nav | We feel worse than HN |
| Topic tracker | Follows AI/security only | Watchlists, alerts, history search | Misclassified topics |
| Occasional visitor | Arrives via search/social | Understand what this is in 5 s | Thinks it is official HN |

## Interview guide (30 min)
1. Warm-up: role, how they currently follow tech news (HN, RSS, newsletters, X/Bluesky).
2. Last time they checked HN: walk me through it. What did they open? What did they skip?
3. When did they last miss something important? How did they find out?
4. Topics they care about; topics they actively avoid.
5. Comments: read them? When? On which device?
6. Digests/email: currently subscribed to any? What makes them unsubscribe?
7. Accounts: would they sign in to save topics? What data would they be uneasy sharing?
Rules: ask about past behaviour, not hypotheticals; no leading questions; record with consent only.

## Usability test script (deploy preview, 20 min)
Tasks (measure success, time, errors, quotes):
1. "Find the most discussed story on the front page right now and open its HN discussion."
2. "Find recent stories about Rust from the last day." (search/topic)
3. "Something new appeared at the top—show it." (live-update pill)
4. "Open a story with many comments, collapse a long thread, return to the feed at the same position."
5. "Using only the keyboard, open the third story." (with accessibility-specialist)
6. "Who made this site? Is it official Hacker News?" (attribution clarity)
Post-test: SUS questionnaire or a single ease rating (1–7) per task.

## Synthesis procedure
1. Capture observations as atomic notes (`P3, task 4: lost scroll position after back`).
2. Affinity-cluster into themes; count participants per theme.
3. Rate severity: 4 = blocks task, 3 = major delay, 2 = minor, 1 = cosmetic.
4. Write insight cards: *Insight → Evidence (n/5) → Recommendation → Owner agent*.
5. File GitHub issues labelled `ux-finding` with severity; feed the product-owner's backlog.

## Project-specific notes
- Recruit from real HN readers ethically: never post recruitment as a Show HN; use your own network or a separate "Ask HN" only if it is genuinely a question.
- Store recordings/notes privately; delete raw recordings within 90 days; no participant PII in the repo.
- Test on throttled mobile networks: N+1 HN fetches make slow networks the real-world case.

## Pitfalls
- Asking "would you use X?" (everyone says yes).
- Testing only with the team.
- Ignoring the "is this official HN?" confusion signal.

## Used by
- ux-researcher
- frontend-engineer
- ui-designer
- accessibility-specialist
