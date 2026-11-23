---
name: seo-content-marketing
description: Handles SEO and content marketing for the HN tech-news app on Netlify, covering meta tags, Open Graph/Twitter cards, canonical URLs, sitemaps, robots rules for dynamic HN-derived pages, structured data, landing copy and a content calendar. Use when asked to "add meta tags", "generate a sitemap", "set up OG images", "should story pages be indexed", "write a blog post", "plan content", or to audit search visibility.
metadata:
  id: S30
  used-by: [frontend-engineer, product-marketing-strategist, seo-content-marketer]
  mvp: false
---
# SEO & Content Marketing

## Purpose
Make the app's own pages (landing, topic pages, about, blog) discoverable and shareable, without creating thin duplicate copies of HN content that hurt rankings or misrepresent HN.

## When to use
- Building page templates/head tags, sitemap, robots, OG images.
- Planning blog/launch content and social posts.

## Indexing strategy (decision table)
| Page | Index? | Why |
|---|---|---|
| `/` landing | Yes | Our unique value |
| `/topics/<topic>` (e.g. `/topics/rust`) | Yes, if it has unique intro text + live list | Unique-ish, useful hub |
| `/top`, `/new`, etc. | Index `/top` only, others `noindex,follow` | Volatile duplicates of HN lists |
| `/item/:id` story/comment view | **`noindex,follow`** + canonical to HN item? See note | Duplicate of HN thread; thin content |
| `/search?q=` | `noindex` | Infinite URL space |
| `/about`, `/help`, `/privacy`, `/terms`, `/blog/*` | Yes | Original content |
Note: for `/item/:id`, prefer `noindex` with a visible link to HN. Don't canonicalize to news.ycombinator.com unless counsel/team agree; either way avoid competing with HN for its own threads.

## Head tag template
```html
<title>{Page title} · {AppName}</title>
<meta name="description" content="{≤155 chars, unique per page}">
<link rel="canonical" href="https://{domain}{path}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="https://{domain}/og/{slug}.png">  <!-- 1200×630 -->
<meta property="og:url" content="https://{domain}{path}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="{index,follow | noindex,follow}">
```
- Use the custom domain as canonical, not `*.netlify.app`; redirect `*.netlify.app` and deploy previews must be `noindex` (Netlify adds `X-Robots-Tag: noindex` on deploy previews by default; verify).
- OG images: one static image per topic + default; or generated at build. Never use HN/YC logos.

## Sitemap & robots
- `sitemap.xml` generated at build: landing, topic pages, about/help/legal, blog posts. Exclude item, search, feed variants.
- `robots.txt`: `Disallow: /api/` and `/search`; `Sitemap: https://{domain}/sitemap.xml`.
- Structured data: `WebSite` + `SearchAction` (optional), `Article` for blog posts. Don't mark HN stories as our `NewsArticle`.

## Performance = SEO
Feed SSR/SSG for fast LCP (see caching-performance), CLS-free story rows, small JS. Lighthouse SEO score ≥ 95 on landing and topic pages.

## Content calendar (first 8 weeks, example)
| Week | Piece | Channel | Goal |
|---|---|---|---|
| 1 | "Building a live HN reader on Netlify Functions + Blobs" | blog, dev.to cross-post (canonical to ours) | Launch credibility |
| 2 | "Handling the HN API's N+1 problem" | blog | Developer SEO |
| 3 | Topic page launch: AI, Security, Rust | site + social | Hub pages |
| 4 | "What HN talked about this month in <topic>" (links to HN threads) | blog/newsletter | Recurring content |
| 6 | Open-source changelog / roadmap | blog, GitHub | Community |
| 8 | Lessons from Show HN launch | blog | Transparency |
Rules: original analysis only, link generously to HN threads and original sources, no reposting comment text in bulk.

## Audit checklist
- [ ] Unique title/description per indexable page; canonical correct.
- [ ] Deploy previews and `*.netlify.app` not indexed.
- [ ] Sitemap valid, submitted in Search Console.
- [ ] OG preview tested (share debugger tools).
- [ ] No indexable infinite spaces (search, pagination beyond page 1 for feeds).

## Pitfalls
- Indexing thousands of `/item/:id` pages that duplicate HN → thin-content penalty and bad optics.
- Keyword-stuffed topic pages.
- Using "Hacker News" in title tags in a way that implies officialness (use "for Hacker News", "unofficial").

## Used by
- frontend-engineer
- product-marketing-strategist
- seo-content-marketer
