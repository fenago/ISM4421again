// GET /api/feed/:name?page=N  -> cached JSON page of normalized stories.
// One fan-out to HN serves every visitor thanks to Netlify's CDN cache (docs/05, docs/08).
import { fetchFeed, FEEDS } from "../../public/js/hn-core.js";

export default async (req, context) => {
  const url = new URL(req.url);
  const feed = context?.params?.name || url.searchParams.get("feed") || "top";
  const page = Math.max(0, Math.min(20, parseInt(url.searchParams.get("page") || "0", 10) || 0));
  if (!FEEDS[feed]) {
    return Response.json({ error: `Unknown feed. Use one of: ${Object.keys(FEEDS).join(", ")}` }, { status: 400 });
  }
  try {
    const data = await fetchFeed(feed, page);
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("feed error", feed, page, err);
    return Response.json({ error: "Upstream Hacker News request failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
};

export const config = { path: "/api/feed/:name" };
