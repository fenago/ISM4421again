# Netlify Platform - Reference

Companion to [SKILL.md](SKILL.md). Values marked "verify" change with Netlify plans; confirm in the Netlify docs before relying on them.

## Function types
| Type | How declared | Time budget (verify) | Use in this app |
|---|---|---|---|
| Synchronous (v2) | `export default (req, ctx) => Response` + `config.path` | ~10 s default (raisable on paid plans) | `/api/feeds/:name`, `/api/stories/:id`, `/api/search` |
| Scheduled | `config.schedule = "<cron>"` | ~30 s | `refresh-feeds` (every 1-5 min) |
| Background | file name ends in `-background` | up to 15 min, returns 202 immediately | Optional: nightly digests, backfills from Algolia |
| Edge (Deno) | `netlify/edge-functions/*.ts` + `config.path` | very short CPU | Headers, redirects, geo. Not HN fan-out |

Functions v2 signature:
```ts
import type { Config, Context } from "@netlify/functions";
export default async (req: Request, context: Context) => {
  context.params;            // route params from config.path
  context.deploy.context;    // "production" | "deploy-preview" | "branch-deploy" | "dev"
  context.waitUntil(p);      // finish work after responding (best effort)
  return Response.json({ ok: true });
};
export const config: Config = { path: ["/api/stories/:id"], method: ["GET"] };
```

## Blobs API cheat sheet (`@netlify/blobs`)
```ts
import { getStore, getDeployStore } from "@netlify/blobs";
const feeds = getStore("feeds");                              // site-wide, eventual consistency
const strong = getStore({ name: "feeds", consistency: "strong" });
await feeds.setJSON("feed:top", payload, { metadata: { generatedAt: Date.now() } });
const data = await feeds.get("feed:top", { type: "json" });   // null if missing
const meta = await feeds.getWithMetadata("feed:top", { type: "json" }); // { data, metadata, etag } | null
const { blobs } = await feeds.list({ prefix: "item:" });
await feeds.delete("item:123");
```
Suggested keys:
| Store | Key | Value | Written by |
|---|---|---|---|
| `feeds` | `feed:{top,new,best,ask,show,job}` | `{ ids, stories[0..90], generatedAt }` | refresh-feeds |
| `items` | `item:{id}` | `{ story, fetchedAt }` | refresh-feeds, story fn |
| `search` | `q:{hash}` | `{ stories, page, nbPages, fetchedAt }` | search fn |
| `meta` | `refresh:last` | `{ at, durationMs, errors }` | refresh-feeds (health check) |

Blobs size/throughput limits exist per plan (verify); keep values small (one feed blob ~50-100 KB).

## Caching headers
| Header | Who obeys | Example |
|---|---|---|
| `Cache-Control` | Browser (and CDN if no CDN-specific header) | `public, max-age=15` |
| `Netlify-CDN-Cache-Control` | Netlify CDN only | `public, s-maxage=60, stale-while-revalidate=300, durable` |
| `Cache-Tag` / `Netlify-Cache-Tag` | Netlify CDN purge | `feed-top` |
| `Netlify-Vary` | Cache key | `query=page` to key on specific query params |

`durable` stores the response in Netlify's durable cache shared across edge nodes, cutting Function invocations. Purge with `purgeCache({ tags })` from `@netlify/functions`.

## Cron syntax
Standard 5 fields, UTC. Examples: `*/2 * * * *` (every 2 min), `@hourly`, `0 6 * * *` (daily 06:00 UTC digest).

## CLI
```bash
npx netlify login && npx netlify link          # one-time
npx netlify dev                                # local site + functions + blobs sandbox
npx netlify functions:invoke refresh-feeds     # run scheduled fn locally
npx netlify env:list / env:set KEY value --context production
npx netlify deploy --build                     # draft deploy URL
npx netlify deploy --build --prod              # production (normally done by Git integration)
npx netlify logs:function feeds                # tail function logs (verify command name in current CLI)
```

## Deploy flow (GitHub -> Netlify)
- Netlify Git integration builds every push; PRs get **deploy previews** with a unique URL and a GitHub status check.
- `main` -> production. Rollback = "Publish deploy" on a previous deploy in the Netlify UI (instant, no rebuild).
- Scheduled Functions only run on the production deploy.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| `/api/...` returns the SPA `index.html` | Function not deployed or `config.path` missing; SPA catch-all redirect shadows it (v2 paths take precedence, older redirect-based setups don't) |
| Feed never updates in preview | Scheduled functions don't run in previews; invoke manually |
| Function 502 / timeout | Fan-out too big; lower item count, add per-request timeouts |
| Live stream works locally, not in prod | CSP `connect-src` missing `https://*.firebaseio.com` |
| Blob read returns old data right after write | Eventual consistency; use `consistency: "strong"` or tolerate lag |
