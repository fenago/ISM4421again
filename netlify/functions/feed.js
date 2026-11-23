// GET /api/feed/:name?page=N  -> cached JSON page of normalized stories.
// One fan-out to HN serves every visitor thanks to Netlify's CDN cache (docs/05, docs/08).
import { fetchFeed, isFeed, FEEDS, MAX_PAGE } from "../../public/js/hn-core.js";

// Total budget for the HN fan-out; Netlify's synchronous limit is ~10 s (26 s max configurable).
const DEADLINE_MS = 8000;

const json = (body, status, headers = {}) => Response.json(body, { status, headers });

export default async (req, context) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405, { Allow: "GET, HEAD", "Cache-Control": "no-store" });
  }
  const url = new URL(req.url);
  const feed = context?.params?.name || url.searchParams.get("feed") || "top";
  if (!isFeed(feed)) {
    return json({ error: `Unknown feed. Use one of: ${Object.keys(FEEDS).join(", ")}` }, 400, { "Cache-Control": "no-store" });
  }
  const rawPage = url.searchParams.get("page") ?? "0";
  const page = /^\d{1,3}$/.test(rawPage) ? Number(rawPage) : NaN;
  if (!Number.isInteger(page) || page > MAX_PAGE) {
    return json({ error: `Invalid page. Use an integer 0..${MAX_PAGE}` }, 400, { "Cache-Control": "no-store" });
  }
  try {
    const data = await fetchFeed(feed, page, { deadlineMs: DEADLINE_MS });
    // Partial pages (some item fetches failed) are cached only briefly so they self-heal.
    const cdn = data.partial
      ? "public, s-maxage=10, stale-while-revalidate=30"
      : "public, s-maxage=60, stale-while-revalidate=300";
    return json(data, 200, { "Cache-Control": "public, max-age=0, must-revalidate", "Netlify-CDN-Cache-Control": cdn });
  } catch (err) {
    console.error("feed error", feed, page, err?.message);
    return json({ error: "Upstream Hacker News request failed" }, 502, { "Cache-Control": "no-store" });
  }
};

export const config = { path: "/api/feed/:name" };
