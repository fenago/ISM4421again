# ISM4421again

An unofficial, live-updating tech-news reader for Hacker News. This is a **proof of concept**.

> **Disclaimer:** This project is not affiliated with, endorsed by, or sponsored by Y Combinator or Hacker News. "Hacker News" is a trademark of its respective owner. Content comes from the public Hacker News Firebase API and the Algolia HN Search API.
>
> **Name:** "Tech News Radar" is a **placeholder** name, pending trademark/name clearance by legal counsel (see `knowledge/legal-counsel/`). Do not treat it as final.

## Features

- Browse HN feeds (top, new, best, ask, show, job) in a fast, static UI.
- Live updates straight from the HN Firebase API in the browser.
- Search via the Algolia HN API.
- Server-side feed endpoint cached on Netlify's CDN to avoid a request fan-out per visitor.

## Architecture

- Static site in `public/` (HTML, CSS, ES modules). No build step, no npm dependencies.
- Shared HN client and normalization in `public/js/hn-core.js`, used by both the browser and the function.
- One Netlify Function, `netlify/functions/feed.js` (Functions v2, route `/api/feed/:name`), imports `hn-core.js` and returns normalized, paginated JSON.
- Responses carry `Netlify-CDN-Cache-Control` (`s-maxage=60`, `stale-while-revalidate=300`), so one upstream fan-out serves all visitors.
- `netlify.toml` sets publish dir, functions dir, Node 20, the CSP and other security headers, and short cache TTLs for unhashed assets.

## Deploy (Netlify)

1. In Netlify: **Add new site** -> **Import from Git** -> **GitHub**.
2. Pick the repo `fenago/ISM4421again` and branch `main`.
3. Build settings are read from `netlify.toml` (publish `public`, functions `netlify/functions`, no build command). Leave the UI fields as detected.
4. No environment variables or secrets are required. Click **Deploy**.

Every pull request gets a deploy preview; a merge to `main` publishes to production. To roll back, open **Deploys** in Netlify, choose a previous good deploy and click **Publish deploy**.

## Run locally

- Full stack (static site + function): `npx netlify-cli dev`, then open the printed URL (usually http://localhost:8888).
- UI only: serve `public/` with any static server, for example `npx serve public` or `python3 -m http.server -d public 8000`. Without the function, the UI falls back to calling Hacker News directly.

## Tests

- `npm test` (runs `node --test tests/`; needs Node 18+ and no installs).
- Playwright E2E, if present under `tests/`, is run with its own instructions in that folder.
- CI (`.github/workflows/ci.yml`) runs a `node --check` syntax pass over `public/js` and `netlify/functions`, then `npm test`, on every push and PR to `main`.

## For the agent team

See [CLAUDE.md](CLAUDE.md) for the agent roster, conventions and workflow.
