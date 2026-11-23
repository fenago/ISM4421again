---
name: netlify-platform
description: Explains how this HN app runs on Netlify - netlify.toml, Functions v2 (/api routes), Scheduled Functions that cron-poll HN into Netlify Blobs, Blobs read/write, CDN cache headers and purge, Edge Functions, env vars per context, deploy previews, redirects and security headers, local `netlify dev`, and platform limits. Use when writing netlify.toml, adding a Function or scheduled job, storing feeds in Blobs, configuring headers/redirects, or debugging a deploy.
metadata:
  id: S06
  used-by: [solution-architect, hn-api-integration-engineer, search-discovery-engineer, performance-realtime-engineer, security-engineer, devops-netlify-engineer, sre-monitoring-engineer, finops-analyst]
  mvp: true
---
# Netlify Platform

## Purpose
Netlify shapes the architecture ([expert-roster](../../../docs/expert-roster.md#deployment-context-that-shapes-the-roster)): static/SSR frontend on the CDN, short-lived Functions, a Scheduled Function pre-building feeds into Blobs, browser `EventSource` to Firebase for live updates, Algolia proxied via a Function. Full reference: [reference.md](reference.md).

## When to use
Editing `netlify.toml`, creating anything under `netlify/functions/`, using Blobs, setting cache/security headers, env vars, deploy previews, or diagnosing a failed deploy.

## Topology
```
Scheduled fn refresh-feeds (*/2 * * * *) --fetch--> HN Firebase (+ Algolia topics)
        | setJSON
        v
   Netlify Blobs store "feeds"   <--get-- fn feeds  (/api/feeds/:name)  <-- CDN <-- browser
                                         fn story  (/api/stories/:id)
                                         fn search (/api/search) --> Algolia
browser --EventSource--> hacker-news.firebaseio.com (live list changes)
```

## netlify.toml (starting point)
```toml
[build]
  command = "npm run build"
  publish = "dist"                 # or framework default; Next.js runtime sets this itself

[build.environment]
  NODE_VERSION = "20"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# SPA only (Vite). Not needed for Next.js/SvelteKit adapters.
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; connect-src 'self' https://hacker-news.firebaseio.com https://*.firebaseio.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[context.deploy-preview.environment]
  APP_ENV = "preview"
```
Functions v2 declare their own routes with `config.path`, so no `/api/*` redirect is needed.

## Scheduled Function: feed cache
```ts
// netlify/functions/refresh-feeds.mts
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getFeedIds, getItem, mapLimit } from "../../src/lib/hn/client";
import { toStory } from "../../src/lib/hn/normalize";

const FEEDS = ["top", "new", "best", "ask", "show", "job"] as const;

export default async () => {
  const store = getStore("feeds");
  const started = Date.now();
  for (const feed of FEEDS) {
    if (Date.now() - started > 22_000) break;                   // stay under the scheduled-fn limit
    try {
      const ids = await getFeedIds(feed);
      const top = ids.slice(0, 90);                              // 3 pages pre-rendered
      const items = await mapLimit(top, 12, id => getItem(id).catch(() => null));
      const stories = items.flatMap((it, i) => { const s = it && toStory(it, i + 1); return s ? [s] : []; });
      await store.setJSON(`feed:${feed}`, { ids, stories, generatedAt: new Date().toISOString() });
    } catch (e) { console.error("refresh failed", feed, e); }    // keep previous blob (stale > empty)
  }
};
export const config: Config = { schedule: "*/2 * * * *" };
```
Make it incremental once it works: store an item cache (`item:{id}` with `fetchedAt`), only fetch new IDs plus IDs in `/updates.json` (see `caching-performance`).

## Read Function
```ts
// netlify/functions/feeds.mts
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
const VALID = new Set(["top", "new", "best", "ask", "show", "job"]);
export default async (req: Request, ctx: Context) => {
  const { name } = ctx.params;
  if (!name || !VALID.has(name)) return new Response("unknown feed", { status: 404 });
  const page = Math.max(0, Number(new URL(req.url).searchParams.get("page") ?? 0) | 0);
  const data = await getStore("feeds").get(`feed:${name}`, { type: "json" });
  if (!data) return new Response("warming up", { status: 503, headers: { "Retry-After": "30" } });
  return Response.json({ ...data, stories: data.stories.slice(page * 30, page * 30 + 30) }, {
    headers: { "Cache-Control": "public, max-age=15",
               "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300, durable",
               "Cache-Tag": `feed-${name}` },
  });
};
export const config: Config = { path: "/api/feeds/:name" };
```

## Key facts and limits (verify current values in Netlify docs)
- **Functions are short-lived**: synchronous functions time out in seconds (default ~10 s; scheduled functions ~30 s; background functions up to 15 min). No long-lived SSE ingestor - use cron polling.
- **Scheduled Functions run only on the published production deploy**, not on deploy previews or branch deploys. Test them with `netlify functions:invoke refresh-feeds` or by hitting `/.netlify/functions/refresh-feeds` under `netlify dev`.
- Minimum cron granularity is 1 minute; schedule in UTC.
- **Blobs**: `getStore(name)` is site-wide and **eventually consistent** by default (`getStore({ name, consistency: "strong" })` if you must read-your-write). `getDeployStore()` scopes data to a deploy. Values: string/ArrayBuffer/Blob, plus `setJSON` / `get(key, {type:"json"})` / `getWithMetadata` / `list({ prefix })` / `delete`.
- Env vars: set in UI/CLI with per-context scopes; read via `Netlify.env.get("X")` or `process.env.X` in Functions. Never expose to client bundles unless prefixed for the framework (`VITE_`, `NEXT_PUBLIC_`) and non-secret. HN/Algolia need **no secrets**.
- Edge Functions (Deno, `netlify/edge-functions/`) run at the edge for every request - use only for cheap header/geo logic, not HN fan-out.
- Deploy previews: every PR gets a URL; Blobs in site-wide stores are shared with production - namespace keys by `context.deploy.context` if previews write.
- CDN purge: `import { purgeCache } from "@netlify/functions"; await purgeCache({ tags: ["feed-top"] })` after a refresh if you use long `s-maxage`.

## Local dev
`npm i -D netlify-cli` then `npx netlify dev` (Functions + redirects + Blobs sandbox locally), `npx netlify functions:invoke <name>`, `npx netlify deploy` (draft) / `--prod`. In this sandbox HN hosts are blocked (403) - seed Blobs from fixtures for local runs.

## Pitfalls
- Waiting for scheduled refresh in a deploy preview (it never runs there).
- Scheduled function doing all 6 feeds x 500 items in one run - exceeds timeout. Cap and go incremental.
- Overwriting a good blob with an empty list on HN error.
- CSP missing `*.firebaseio.com` (307 redirect target) -> live stream breaks only in production.
- Caching `/api/search` without a normalized key -> low hit rate, Algolia budget burned.

## Used by
solution-architect, hn-api-integration-engineer, search-discovery-engineer, performance-realtime-engineer, security-engineer, devops-netlify-engineer, sre-monitoring-engineer, finops-analyst
