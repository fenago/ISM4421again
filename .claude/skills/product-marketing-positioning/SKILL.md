---
name: product-marketing-positioning
description: Defines positioning, naming, messaging and launch plans for the HN tech-news app, covering target audience, differentiation from news.ycombinator.com and other readers, name screening (no implied HN/YC affiliation), message house, and a phased launch plan (Show HN, social, newsletters). Use when asked to "name the app", "write the tagline", "position this", "write landing page messaging", "plan the launch", or to review copy for tone and claims.
metadata:
  id: S28
  used-by: [product-owner, product-marketing-strategist, seo-content-marketer, community-manager]
  mvp: false
---
# Product Marketing & Positioning

## Purpose
Give the app a clear reason to exist ("why not just open HN?") and a consistent voice across landing page, Show HN post, README and social, without overclaiming or implying affiliation.

## When to use
- Naming, tagline, landing page, README intro, launch plan, release notes.

## Positioning canvas (fill and keep in `docs/marketing/positioning.md`)
| Element | Draft for this app (validate with ux-research) |
|---|---|
| Target customer | Developers/tech workers who follow HN but can't read it all day |
| Problem | HN moves fast; important stories in your areas scroll away; comments are long |
| Category | Live, topic-filtered Hacker News reader |
| Alternatives | HN front page, HN RSS feeds, third-party HN apps, newsletters, X/Bluesky |
| Unique value | Live "N new stories" updates + topic watchlists + (later) daily digest of what you missed |
| Proof | <60 s freshness, open source, no account needed, no trackers |
| Tone | Plain, technical, modest; HN readers distrust hype |

## Message house
- **Umbrella:** "Hacker News, filtered to what you care about, updated live."
- Pillars: (1) Live: new stories appear within a minute. (2) Focused: topics and thresholds cut noise. (3) Respectful: free, no account, no tracking, links back to HN.
- Proof points per pillar (metrics, screenshots, repo link).

## Naming procedure
1. Generate 15–20 candidates; avoid "Hacker News", "HN" as a leading brand element, "YC", "Y Combinator", orange-Y imagery.
2. Screen: pronounceable, ≤ 2 words, .com/.dev/.app or `<name>.netlify.app` availability, GitHub org/repo free, no obvious conflict in software trademarks (quick search; then attorney check via legal-terms-ip-attribution).
3. Descriptor line handles the HN reference nominatively: "<Name> — a live, topic-filtered reader for Hacker News (unofficial)."
4. Test top 3 with 5 target readers (memorability, what they think it does).

## Copy rules
- No superlatives without proof ("fastest"); quantify instead ("new stories in under a minute").
- Never "official", never HN/YC logos; include non-affiliation line on landing page.
- Credit data sources: HN API, Algolia HN Search.
- Privacy claims must match reality (privacy-data-protection).

## Launch plan (phased)
| Phase | When | Actions | Owner |
|---|---|---|---|
| 0 Ready | T−2 weeks | Legal/privacy checklist, analytics, monitoring, load-tested caching, landing + README polished | product-owner, legal-counsel, sre |
| 1 Soft launch | T−1 week | Friends/colleagues, fix top issues | community-manager |
| 2 Show HN | T | Post per hn-community-norms; maker online all day | community-manager, hn-community-expert |
| 3 Amplify | T+1–7 d | Blog post "how we built it on Netlify" (seo-content-marketing), dev newsletters, Reddit/Lobsters where on-topic and allowed | seo-content-marketer |
| 4 Learn | T+2 weeks | Retention, feedback themes, roadmap update | growth-analytics-marketer, product-owner |

## Landing page outline
Hero (umbrella + screenshot + "Open the live feed" CTA, no signup) → 3 pillars → how it works (HN API + Algolia, cached on Netlify) → privacy line → FAQ (official? cost? data?) → footer attribution.

## Pitfalls
- Positioning against HN ("better than HN"); position as a companion.
- Launch copy that promises V2 features.
- Gated "join waitlist" as the only CTA on Show HN.

## Used by
- product-owner
- product-marketing-strategist
- seo-content-marketer
- community-manager
