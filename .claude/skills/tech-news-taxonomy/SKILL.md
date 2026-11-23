---
name: tech-news-taxonomy
description: Defines the topic taxonomy, keyword/regex and domain rules, and editorial signal thresholds that decide what counts as "relevant tech news" in the HN app. Use when asked to "define topics", "classify this story", "add a watchlist topic", "tune topic rules", "what counts as AI/security news", set points/velocity thresholds, or review misclassified stories.
metadata:
  id: S14
  used-by: [tech-news-editor, hn-community-expert, search-discovery-engineer, ai-ml-engineer, product-marketing-strategist, seo-content-marketer]
  mvp: false
---
# Tech-News Domain & Topic Taxonomy

## Purpose
Give the app a stable, explainable way to tag HN stories by topic and filter noise, so topic feeds, watchlists, digests and SEO landing pages all share one vocabulary.

## When to use
- Designing or extending the topic list; writing or reviewing classification rules.
- Choosing signal thresholds (points, comments, velocity) for "worth showing".
- Investigating misclassifications reported by users or QA.

## Core knowledge
- HN item `type` is `story|job|comment|poll|pollopt`. Ask/Show/Launch/Tell are all `type: "story"`; classify **kind** by title prefix (`Ask HN:`, `Show HN:`, `Launch HN:`, `Tell HN:`) and presence of `url` (docs/07).
- `title` is HTML-encoded: decode entities before matching. `url` may be `""` → treat as missing.
- Kind and topic are separate axes: a Show HN can be `ai` + `open-source`.
- Rules first (deterministic, testable), ML/LLM later as an additional signal with rules as fallback (docs/08).

## Starter taxonomy (v1)
| Topic id | Label | Title keyword rules (case-insensitive, word boundaries) | Domain rules |
|---|---|---|---|
| `ai` | AI & ML | LLM, GPT, Claude, Gemini, transformer, diffusion, neural, machine learning, AI (word) | arxiv.org (+ ML terms), huggingface.co, openai.com, anthropic.com |
| `security` | Security & Privacy | CVE-\d+, vulnerability, exploit, breach, ransomware, zero-day, malware, phishing | krebsonsecurity.com, bleepingcomputer.com |
| `programming` | Languages & Dev | Rust, Go, Python, TypeScript, Zig, compiler, GC, WASM | github.com (fallback), *.dev blogs |
| `web` | Web & Frontend | CSS, browser, JavaScript, React, HTML, WebGPU | developer.mozilla.org, web.dev |
| `infra` | Cloud & Infra | Kubernetes, Postgres, database, SQLite, AWS, outage, Linux | aws.amazon.com, cloud.google.com |
| `hardware` | Hardware & Chips | CPU, GPU, RISC-V, ARM, chip, semiconductor | anandtech-style hardware sites |
| `startups` | Startups & Business | YC, funding, raises, acquires, IPO, layoffs, startup | techcrunch.com |
| `science` | Science & Research | physics, biology, paper, study, NASA | nature.com, science.org, arxiv.org |
| `open-source` | Open Source | open source, OSS, license, GPL, MIT license, fork | github.com, gitlab.com, codeberg.org |
| `policy` | Policy & Law | antitrust, regulation, EU, FTC, court, copyright | gov domains |
Keep the list ≤ 12 topics; add `other` as fallback. Topics are multi-label (max 3 per story).

## Rule format (store as data, e.g. `src/topics/rules.json`)
```json
{ "id": "ai", "label": "AI & ML", "version": 3,
  "include": ["\\b(LLMs?|GPT-?\\d*|Claude|transformers?|AI)\\b"],
  "exclude": ["\\bAI\\b.*\\b(Adobe Illustrator)\\b"],
  "domains": ["huggingface.co", "arxiv.org"],
  "minScore": 0 }
```
- Match against decoded title + registrable domain (strip `www.`; keep subdomain for `*.github.io` blogs).
- Domain rule alone may tag a topic only for topic-specific domains; generic hosts (github.com, medium.com, substack.com, youtube.com) need a keyword hit too.

## Signal thresholds (editorial defaults)
| Surface | Default rule |
|---|---|
| Topic feed | score ≥ 20 OR velocity ≥ 10 pts/hr in first 3 h |
| "High signal" toggle | score ≥ 100 OR comments ≥ 50 |
| Daily digest | top N by peak score per topic in last 24 h, N=5 |
| Exclude | `dead`, `deleted`, `type=job` (unless Jobs feed) |
Thresholds are user-tunable later; document changes in an ADR.

## Procedure: add or change a topic
1. Write the definition in one sentence plus 5 positive and 5 negative example titles (real HN titles, with item IDs).
2. Draft include/exclude regex + domains; bump `version`.
3. Add fixture tests: each example title → expected topics. Run on a recorded sample of ~500 top stories; report precision on a 50-item hand-labelled sample (target ≥ 0.9) and coverage (% of stories tagged non-`other`).
4. Check overlap with existing topics; if > 40% overlap, merge or narrow.
5. Hand to search-discovery-engineer if an Algolia query should back the topic feed (e.g. `/search_by_date?query=rust&tags=story&numericFilters=points>20`).

## Editorial judgement guidelines
- Prefer precision over recall for watchlists: a missed story is cheaper than noise.
- Don't rewrite or editorialize HN titles; display them as HN shows them.
- Topic labels are neutral and descriptive; no clickbait framing.

## Pitfalls
- Matching on encoded HTML (`&#x27;`), missing word boundaries ("AI" in "MAIL", "Go" in "Google").
- Over-tagging github.com as `open-source` for everything.
- Treating jobs from `/topstories` as news.
- Changing rules without re-running fixtures, which silently shifts digests.

## Used by
- tech-news-editor
- hn-community-expert
- search-discovery-engineer
- ai-ml-engineer
- product-marketing-strategist
- seo-content-marketer
