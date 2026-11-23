# Expert Roster: HN Tech-News App

The advisors (future agents) a consultant needs to take the [research in this folder](README.md) from concept to a live app on **GitHub → Netlify**.

⭐ = **Minimum viable team.** Start with these 6; add others as the project grows.

## Deployment context that shapes the roster

The app is hosted on Netlify, so:

- **Frontend:** a static site or SPA on Netlify's CDN.
- **Server side:** Netlify Functions and Scheduled Functions. These are short-lived, so they can't hold an always-on live connection (the SSE ingestor in [08](08-app-architecture.md)).
- **Live updates:** the browser connects directly to HN Firebase with `EventSource`.
- **Caching:** a Scheduled Function (cron, every 1–5 min) pre-fetches feeds into Netlify Blobs or a small DB. This removes the N+1 problem for users.
- **Search:** Algolia, proxied through a Netlify Function with caching.

---

## 1. Experts (agents)

### Leadership & coordination
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A01 | ⭐ | **Product Owner / Consultant Lead** | Owns the vision, MVP scope, priorities and acceptance criteria, and coordinates all other agents. |
| A02 | | Project Manager / Scrum Master | Turns scope into a backlog and sprints, tracks progress, and removes blockers between agents. |

### Business domain
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A03 | | Tech-News Editorial & Curation Expert | Defines the topic taxonomy, signal thresholds and what "relevant tech news" means for the user. |
| A04 | | Hacker News Community & Ecosystem Expert | Advises on HN culture, etiquette, ranking behaviour and how to launch to the HN audience without backlash. |
| A05 | | UX Researcher | Interviews target readers, maps reading habits and validates features (feeds, digests, filters). |

### Technical
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A06 | ⭐ | **Solution Architect** | Designs the Netlify-native architecture, data flow, caching and module contracts, and makes the stack decisions. |
| A07 | ⭐ | **HN API Integration Engineer** | Builds the HN client (fan-out, retries, normalization, `null`/dead handling), the Scheduled Function feed cache and the Algolia search proxy. |
| A08 | ⭐ | **Frontend Engineer** | Builds the responsive UI: feeds, story and comment views, live "new stories" updates via EventSource, and safe HTML rendering. |
| A09 | | UI / Visual Designer | Creates the design system, layouts, dark/light themes and brand look. |
| A10 | | Accessibility Specialist | Ensures WCAG 2.2 AA: keyboard navigation, screen readers, contrast. |
| A11 | | Search & Discovery Engineer | Owns Algolia queries, topic feeds, ranking/velocity scoring and rate-limit-aware caching. |
| A12 | | Data Engineer | Designs storage (Blobs, Supabase or Postgres), history snapshots, and digest and trend pipelines. |
| A13 | | AI/ML Engineer | Builds topic classification and optional LLM summaries of stories and discussions. |
| A14 | | Performance & Real-time Engineer | Tunes concurrency, caching TTLs, Core Web Vitals, and stream reconnect/fallback behaviour. |
| A15 | | Application Security Engineer | Covers HTML sanitization/XSS, CSP headers, dependency audits and secrets handling in Netlify. |
| A16 | ⭐ | **QA / Test Engineer** | Writes the unit, fixture, contract and end-to-end tests covering every edge case in [07](07-gotchas-and-edge-cases.md), and gates releases. |

### Operations
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A17 | ⭐ | **DevOps / Netlify Release Engineer** | Owns the GitHub repo workflow, CI (GitHub Actions), `netlify.toml`, deploy previews, env vars, domains and rollbacks. |
| A18 | | Site Reliability / Monitoring Engineer | Sets up uptime checks, function logs, error tracking (e.g. Sentry), alerts and incident runbooks. |
| A19 | | Technical Writer | Maintains the README, setup and run docs, architecture docs and user help pages. |

### Finance
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A20 | | FinOps / Cost Analyst | Forecasts and monitors Netlify, Algolia, DB and LLM costs, and sets budgets and usage alerts. |
| A21 | | Business Model & Monetization Analyst | Evaluates free, freemium, sponsorship or premium-digest models and pricing. |

### Legal & compliance
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A22 | | Legal Counsel: Content, IP & Terms | Reviews HN/Y Combinator and Algolia usage terms, attribution, trademark (no implied YC affiliation), and drafts the app's Terms of Use. |
| A23 | | Privacy & Compliance Officer | Drafts the privacy policy and cookie/analytics consent, and covers GDPR/CCPA for any accounts or email digests. |

### Marketing & growth
| ID | ⭐ | Role | One-line job description |
|---|---|---|---|
| A24 | | Product Marketing & Brand Strategist | Defines positioning, naming, messaging and the launch plan. |
| A25 | | Growth & Analytics Marketer | Sets up privacy-friendly analytics, funnels, retention metrics and A/B tests. |
| A26 | | SEO & Content Marketer | Covers SEO for the Netlify site, landing page copy, blog content and social posts. |
| A27 | | Community Manager | Runs the Show HN launch, user feedback channels and the feature-request loop. |

**Totals:** 27 experts, of which ⭐ 6 are the minimum viable team: A01, A06, A07, A08, A16, A17.

### Who covers the rest in the MVP
| Missing role | Covered for now by |
|---|---|
| A02 PM | A01 |
| A03 / A04 domain experts | A01 (using [08](08-app-architecture.md)) |
| A09 / A10 design & accessibility | A08 |
| A11 / A12 / A14 search, data, performance | A07 + A06 |
| A15 security | A06 + A16 |
| A18 / A19 monitoring & docs | A17 |
| Finance, legal, marketing | A01 runs a pre-launch checklist; add A22 and A23 before any public launch |

### Suggested hiring order after the MVP
1. A22 Legal and A23 Privacy, before going public
2. A09 Designer
3. A11 Search
4. A15 Security
5. A18 SRE
6. A12 Data and A13 AI/ML, when digests or summaries are added
7. A24–A27 Marketing, at launch
8. A20 and A21 Finance, when costs or revenue matter

---

## 2. Skills (shared across agents)

⭐ marks skills the MVP team needs on day one.

| # | ⭐ | Skill | What it covers | Used by |
|---|---|---|---|---|
| S01 | ⭐ | **HN API Knowledge** | Endpoints, data model, quirks ([02](02-endpoints.md), [03](03-data-model.md), [07](07-gotchas-and-edge-cases.md)) | A01, A03, A04, A06, A07, A08, A11, A12, A13, A16 |
| S02 | ⭐ | **Algolia HN Search** | Query syntax, tags, numeric filters, rate limits ([06](06-algolia-search-api.md)) | A06, A07, A11, A12, A16 |
| S03 | ⭐ | **Real-time Streaming (SSE / EventSource)** | Firebase put/patch events, reconnects, polling fallback ([04](04-realtime-updates.md)) | A06, A07, A08, A14, A16 |
| S04 | ⭐ | **TypeScript / JavaScript Engineering** | Typed clients, async concurrency, error handling | A06, A07, A08, A11, A12, A13, A14, A15, A16 |
| S05 | ⭐ | **Frontend Framework (React / Next.js or SvelteKit)** | Components, routing, state, SSR/SSG on Netlify | A06, A08, A09, A10, A14 |
| S06 | ⭐ | **Netlify Platform** | `netlify.toml`, Functions, Scheduled Functions, Blobs, Edge, env vars, deploy previews, redirects/headers | A06, A07, A11, A14, A15, A17, A18, A20 |
| S07 | ⭐ | **Git / GitHub Workflow & CI** | Branching, PRs, GitHub Actions, protected `main` | A01, A02, A06, A07, A08, A16, A17, A19 |
| S08 | ⭐ | **Caching & Performance** | TTLs, fan-out limits, CDN caching, Core Web Vitals ([05](05-fetching-patterns.md)) | A06, A07, A11, A14, A17 |
| S09 | ⭐ | **HTML Sanitization & Web Security** | DOMPurify, entity decoding, CSP, XSS, dependency audit | A07, A08, A15, A16 |
| S10 | ⭐ | **Software Testing** | Vitest/Jest, recorded fixtures, contract tests, Playwright E2E | A07, A08, A14, A15, A16 |
| S11 | ⭐ | **Requirements & Acceptance Criteria** | User stories, MVP scoping, definition of done ([09](09-agent-team-briefing.md)) | A01, A02, A05, A06, A16 |
| S12 | ⭐ | **Architecture & Technical Decision Records** | Diagrams, trade-offs, decision logs ([08](08-app-architecture.md)) | A01, A06, A12, A14, A15 |
| S13 | | Project Management / Agile | Backlog, sprint planning, status reporting | A01, A02 |
| S14 | | Tech-News Domain & Topic Taxonomy | Topics, keyword/domain rules, editorial judgement | A03, A04, A11, A13, A24, A26 |
| S15 | | HN Community Norms | Show HN guidelines, etiquette, attribution | A04, A22, A24, A27 |
| S16 | | UX Research & Usability Testing | Interviews, personas, usability studies | A05, A08, A09, A10 |
| S17 | | UI / Visual Design & Design Systems | Typography, color tokens, themes, responsive layout | A08, A09, A10, A24 |
| S18 | | Accessibility (WCAG 2.2) | ARIA, keyboard navigation, contrast, screen-reader testing | A08, A09, A10, A16 |
| S19 | | Data Modeling & Storage | SQL/Postgres/Supabase, Netlify Blobs, snapshots, migrations | A06, A07, A12, A13 |
| S20 | | Search Ranking & Relevance | Velocity scoring, personalization, query tuning | A11, A12, A13 |
| S21 | | LLM / NLP Integration | Classification, summarization, prompt design, cost control | A11, A13, A20 |
| S22 | | Observability & Incident Response | Logs, Sentry, uptime, alerts, runbooks | A14, A15, A17, A18 |
| S23 | | Technical Writing | README, API docs, user guides | A01, A06, A19 |
| S24 | | Cost Modeling & FinOps | Usage forecasting, plan limits, budgets | A06, A17, A20, A21 |
| S25 | | Business Modeling & Pricing | Revenue models, unit economics | A01, A20, A21, A24 |
| S26 | | Legal: Terms, IP & Attribution | ToS review, trademark, content licensing | A04, A22 |
| S27 | | Privacy & Data Protection | GDPR/CCPA, consent, privacy policy, data retention | A12, A22, A23, A25 |
| S28 | | Product Marketing & Positioning | Messaging, naming, launch plans | A01, A24, A26, A27 |
| S29 | | Web Analytics & Experimentation | Privacy-friendly analytics, funnels, A/B tests | A05, A25, A26 |
| S30 | | SEO & Content Marketing | Meta tags, sitemaps, Open Graph, content calendar | A08, A24, A26 |
| S31 | | Community Management | Launch posts, feedback triage, moderation | A04, A24, A27 |

### Skills per MVP agent (starter kit)
| Agent | Skills |
|---|---|
| ⭐ A01 Product Owner | S01, S07, S11, S12, S13, S23, S25, S28 |
| ⭐ A06 Solution Architect | S01–S08, S11, S12, S19, S23, S24 |
| ⭐ A07 HN API Integration Engineer | S01–S04, S06–S10, S19 |
| ⭐ A08 Frontend Engineer | S01, S03, S04, S05, S07, S09, S10, S16–S18, S30 |
| ⭐ A16 QA / Test Engineer | S01–S04, S07, S09, S10, S11, S18 |
| ⭐ A17 DevOps / Netlify Release Engineer | S06, S07, S08, S22, S24 |

---

## 3. Path to a live app with the MVP team

1. **A01 + A06:** confirm the open decisions in [09](09-agent-team-briefing.md). Write the architecture decision records (Netlify-native design above).
2. **A17:** set up the repo structure, CI, Netlify site link and deploy previews on every PR.
3. **A07:** build the HN client and Algolia proxy (Functions), plus the feed cache (Scheduled Function + Blobs).
4. **A08:** build the feeds, story/comment views, live updates and search UI.
5. **A16:** run fixture and E2E tests on every PR. These gate the merge to `main`.
6. **A17:** a merge to `main` triggers the Netlify production deploy.
