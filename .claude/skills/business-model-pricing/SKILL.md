---
name: business-model-pricing
description: Evaluates revenue models and unit economics for the HN tech-news app (free/open source, donations, sponsorship, freemium premium digests, B2B team digests), including pricing tiers and break-even math, while respecting that HN data is public and not ours to sell. Use when asked "how could this make money", "should we charge", "price the premium tier", "unit economics", "is sponsorship OK", or to compare monetization options.
metadata:
  id: S25
  used-by: [product-owner, finops-analyst, business-model-analyst, product-marketing-strategist]
  mvp: false
---
# Business Modeling & Pricing

## Purpose
Decide whether and how the app earns money in a way that is sustainable, fits the HN audience's expectations and doesn't monetize HN content itself (we sell our features, not HN's data).

## When to use
- Before building accounts/premium features; before launch messaging; pricing changes.

## Core constraints
- HN content is public, user-authored and attributed; charging for **access to HN stories** is a bad look and legally murky (legal-terms-ip-attribution). Charge for **our value-add**: personalization, digests, alerts, AI summaries, history search, team features.
- The HN audience is ad-averse and tracker-averse; heavy ads or dark patterns will sink a Show HN.
- No implied YC affiliation in any sponsorship or pricing copy.

## Model options
| Model | Fit | Pros | Cons |
|---|---|---|---|
| Free, open source, personal project | High (MVP) | Goodwill, Show HN friendly | No revenue |
| Donations (GitHub Sponsors etc.) | High | Low friction | Small, unpredictable |
| Single tasteful sponsor slot in digest/footer | Medium | Simple | Must be clearly labelled; audience sensitivity |
| Freemium: Pro digests/alerts/AI summaries | Medium–High | Value tied to costs we incur (LLM, email) | Needs accounts, payments, privacy work |
| B2B: team topic digests to Slack/email | Medium | Higher ARPU | Sales effort; data processing terms |
| Display ads / selling data | Low | — | Conflicts with privacy stance and audience |

## Unit economics template
```markdown
Per paying user / month:
  Price P = $<x>
  Variable cost C = email (<n> × $) + LLM (<tokens> × $) + payment fees (<%> × P + fixed) + infra share
  Contribution margin = P − C
Fixed monthly costs F = Netlify plan + DB + domain + monitoring
Break-even paying users = F / (P − C)
Conversion assumption: free→paid <1–3%> → required MAU = break-even / conversion
```
Get cost inputs from finops-cost-modeling; record pricing-page check dates.

## Pricing tier sketch (example to test, not decided)
| Tier | Price | Includes |
|---|---|---|
| Free | $0 | All feeds, live updates, search, local topic filters, no account |
| Pro | ~$3–5/mo or ~$30–50/yr | Saved topics across devices, daily/weekly email digest, keyword alerts, AI thread summaries |
| Team | per-seat or flat | Shared topic digests to Slack/email, admin |

## Procedure: choose a model
1. State the goal: cover costs, side income, or business.
2. List value-add features users said they'd use (ux-research evidence, not guesses).
3. Run unit economics for top 2 options in Base and Pessimistic scenarios.
4. Check legal/privacy implications (payments, accounts, email consent) with legal-counsel and privacy-compliance-officer.
5. Write an ADR with decision, rejected options, and a review trigger (e.g. revisit at 1,000 MAU).
6. Test willingness to pay with a waitlist or "Pro coming soon" button (count clicks, no dark patterns).

## Pitfalls
- Paywalling basic HN feeds.
- Pricing before knowing variable costs of AI/email.
- Launching on Show HN with a pricing page front and center.
- Unlabelled sponsored content in a news feed.

## Used by
- product-owner
- finops-analyst
- business-model-analyst
- product-marketing-strategist
