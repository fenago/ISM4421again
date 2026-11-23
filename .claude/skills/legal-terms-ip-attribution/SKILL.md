---
name: legal-terms-ip-attribution
description: Reviews the HN tech-news app's legal posture on content and IP, covering use of the public HN API and Algolia HN Search, attribution to HN and original sources, trademark (no implied Hacker News/Y Combinator affiliation), content licensing, and drafting the app's Terms of Use. Use when asked "are we allowed to use HN data", "can we call it HN-something", "draft terms of use", "can we show article previews/summaries", "DMCA/takedown process", or for a pre-launch legal checklist.
metadata:
  id: S26
  used-by: [hn-community-expert, legal-counsel]
  mvp: false
---
# Legal: Terms, IP & Attribution

> **Not legal advice.** This skill produces issue-spotting checklists and drafts for discussion. Have a licensed attorney in the relevant jurisdiction review the Terms of Use, naming/trademark decisions and any content-reuse practices before public launch.

## Purpose
Identify and reduce legal risk from how the app reuses HN data, third-party articles and brand names, and give users clear Terms of Use.

## When to use
- Naming/branding, landing copy, logos.
- Any feature that copies more than titles/links (article previews, summaries, comment display, exports, emails).
- Before public launch, monetization, or partnerships.

## Core knowledge (verify current sources before relying on them)
- **HN API:** the official README (github.com/HackerNews/API) publishes data publicly with no key and states no formal license or ToS beyond the README; HN has separate site guidelines/legal pages at news.ycombinator.com. Treat content as **user-authored, attributed** material, not ours. Re-read current HN/YC legal pages at review time.
- **Algolia HN Search:** third-party (Algolia) service with its own terms; documented 10k req/hr/IP limit. Respect limits; don't present it as our search engine without credit ("Search by Algolia" style attribution is customary).
- **Trademarks:** "Hacker News", "Y Combinator" and the "Y" logo belong to Y Combinator. Nominative use ("a reader for Hacker News") is generally lower risk than names that imply endorsement ("Hacker News Pro", "YC News"). No orange-Y logo mimicry.
- **Copyright:** titles/links are low-risk; comments are users' copyrighted expression. Display in context with attribution and links; avoid bulk republication, resale or AI training. Linked articles belong to publishers: don't copy full text; short summaries + link.

## Pre-launch legal checklist
- [ ] Name/logo cleared: no "Hacker News"/"YC"/"Y Combinator" as or in the product name or logo; attorney trademark search done.
- [ ] Footer disclaimer on every page: "Unofficial. Data from the Hacker News API and Algolia HN Search. Not affiliated with or endorsed by Hacker News or Y Combinator."
- [ ] Each story links to original URL and HN thread; author usernames shown and linked to HN profile.
- [ ] No scraping of news.ycombinator.com HTML where the API suffices; caching keeps load polite.
- [ ] Comments shown only in thread context with link to HN; no export/download of comment bodies.
- [ ] Article content: no full-text copies; AI summaries labelled, short, linked (llm-nlp-integration).
- [ ] Terms of Use and Privacy Policy published and linked in footer (privacy-data-protection).
- [ ] Takedown/contact path: email or form to request removal of cached content; response SLA.
- [ ] Third-party licenses: OSS dependency license report (e.g. `license-checker`) and attributions page.
- [ ] If monetized: terms for payments/refunds; sponsorship disclosures.

## Terms of Use outline (draft for attorney review)
1. Who we are; acceptance of terms; eligibility.
2. The service: an unofficial reader of public Hacker News data; no affiliation with HN/YC; availability not guaranteed.
3. Third-party content: stories, comments and linked sites belong to their authors/owners; we don't control or endorse them; links are provided as-is.
4. Acceptable use: no scraping our API at abusive rates, no attempts to circumvent rate limits, no misuse of accounts.
5. Accounts and digests (if any): user responsibilities; termination.
6. AI-generated summaries (if any): may be inaccurate; not advice.
7. Intellectual property: our code/design; open-source license reference if applicable.
8. Copyright complaints/takedown procedure and contact.
9. Disclaimers of warranties; limitation of liability.
10. Changes to terms; governing law (attorney to set); contact.

## Risk triage
| Practice | Risk | Mitigation |
|---|---|---|
| Showing titles + links + metadata | Low | Attribution, link back |
| Displaying comment threads | Low–Medium | In context, linked, no bulk export |
| AI summaries of articles | Medium | Short, labelled, link, honor opt-outs |
| Product name containing "HN"/"Hacker News" | Medium–High | Rename; attorney review |
| Selling HN data / training models on it | High | Don't |

## Pitfalls
- Assuming "public API" means "any use permitted".
- HN-orange branding and "Official" wording.
- Forgetting Algolia is a separate provider with its own terms.

## Used by
- hn-community-expert
- legal-counsel
