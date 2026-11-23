---
name: hn-community-norms
description: Applies Hacker News community norms (site guidelines, Show HN rules, etiquette, attribution of HN content) to the HN tech-news app and its launch. Use when asked "can we post this as a Show HN", "draft the Show HN post", "is this OK with HN culture", "how should we attribute HN", "how do we avoid looking affiliated with YC", or when reviewing UI copy that displays HN titles, users or comments.
metadata:
  id: S15
  used-by: [hn-community-expert, legal-counsel, product-marketing-strategist, community-manager]
  mvp: false
---
# HN Community Norms

## Purpose
Make sure the product and its launch respect how the HN community works, so the app is welcomed rather than flagged, and so HN content is always credited to HN and its authors.

## When to use
- Designing how HN stories, comments and usernames appear in the app.
- Preparing or reviewing a Show HN submission and launch-day replies.
- Any copy, logo or name that mentions "Hacker News", "HN" or Y Combinator.

## Core knowledge (from HN's public guidelines and Show HN rules; re-read the live pages before launch)
- **Site guidelines:** submit things that gratify intellectual curiosity; use the original title (no editorializing, no gratuitous caps/exclamation); don't solicit upvotes or comments; don't post promotional-only content; be civil and substantive in comments.
- **Show HN** is for something you've made that people can **try** right now. It should not be a landing page, sign-up wall, fundraiser or blog post. Titles start with `Show HN:`. Be present in the thread to answer questions.
- **Voting rings / asking friends to upvote** get submissions penalized or accounts banned. Never share a direct "please upvote" link.
- **Reposts:** a small number of reposts is OK if a story got no attention; don't spam.
- HN is run by Y Combinator. "Hacker News" and "Y Combinator" are their names; our app is **unofficial**.

## Attribution rules for the app (non-negotiable)
- Every story card links to the **original URL** (title link) and the **HN discussion** (`https://news.ycombinator.com/item?id={id}`), labelled e.g. "142 comments on HN".
- Show the HN author as `by {username}`, linking to `https://news.ycombinator.com/user?id={username}` (usernames are case-sensitive).
- Display titles exactly as HN does (decode entities only). No rewriting.
- Never present HN comments as our content; comment views are clearly "from Hacker News" with a link to the thread.
- Footer: "Data from the Hacker News API. Not affiliated with Hacker News or Y Combinator."
- No implied ability to vote/comment: the API is read-only; offer "Discuss on HN" links instead.

## Show HN post template
```text
Title: Show HN: <AppName> – <plain description, e.g. a live, topic-filtered Hacker News reader>
URL: <public Netlify URL, usable without sign-up>

Text (optional, first comment from the maker is also fine):
Hi HN, I built <AppName> because <real problem, 1–2 sentences>.
It uses the public HN Firebase API for live updates and Algolia HN Search for topic feeds.
What it does: <3 bullets>. What it doesn't: no accounts needed, no tracking beyond <X>.
Tech: <stack, Netlify Functions, caching to stay polite to the APIs>.
Source: <repo URL if open>. Feedback very welcome, especially on <specific question>.
```

## Launch checklist
- [ ] Works fully without login; loads fast on the deploy URL; mobile OK.
- [ ] Attribution + "not affiliated" footer live; no HN/YC logo or orange "Y" mimicry.
- [ ] Caching in place so a traffic spike doesn't hammer HN/Algolia (stay well under Algolia's 10k req/hr/IP).
- [ ] Privacy policy published if any analytics/accounts/email (see privacy-data-protection).
- [ ] Maker available for several hours after posting to reply; replies are humble, specific, thank critics.
- [ ] No upvote solicitation anywhere (team chat, social, email).
- [ ] Post on a weekday morning US Pacific is common practice; don't game timing beyond that.

## Reply etiquette
- Answer technical questions directly; admit limitations; don't argue with critics, acknowledge and note follow-ups.
- Don't use multiple accounts; disclose that you're the maker.
- Log every feature request into the feedback tracker (see community-management).

## Pitfalls
- Naming the app "Hacker News <X>" or using an orange Y logo → implies affiliation.
- Requiring sign-up before any value → Show HN backlash.
- Scraping news.ycombinator.com HTML instead of using the API.
- Displaying flagged/dead content prominently.

## Used by
- hn-community-expert
- legal-counsel
- product-marketing-strategist
- community-manager
