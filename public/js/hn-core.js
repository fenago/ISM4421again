// Shared HN logic used by both the Netlify Function and the browser fallback.
// See docs/02-endpoints.md, docs/03-data-model.md, docs/05-fetching-patterns.md, docs/07-gotchas-and-edge-cases.md
export const HN_BASE = "https://hacker-news.firebaseio.com/v0";
export const FEEDS = {
  top: "topstories", new: "newstories", best: "beststories",
  ask: "askstories", show: "showstories", job: "jobstories",
};
export const PAGE_SIZE = 30;

export async function getJSON(url, { timeout = 8000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json(); // may be null for missing items (docs/07)
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, 250 * 2 ** attempt + Math.random() * 150));
    } finally {
      clearTimeout(timer);
    }
  }
}

// Bounded parallel fan-out that preserves input order.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch { out[i] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

export function classify(item) {
  if (item.type === "job") return "job";
  if (item.type === "poll") return "poll";
  const t = item.title || "";
  if (/^Show HN:/i.test(t)) return "show";
  if (/^Ask HN:/i.test(t)) return "ask";
  if (/^Launch HN:/i.test(t)) return "launch";
  if (/^Tell HN:/i.test(t)) return "tell";
  return item.url ? "link" : "ask";
}

export function domainOf(url) {
  if (!url) return undefined;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return undefined; }
}

// Raw HN item -> app Story model (docs/03). Returns null for unusable items.
export function normalize(item, rank) {
  if (!item || item.deleted || item.dead || !item.title) return null;
  const url = item.url && item.url.trim() ? item.url : undefined; // jobs may have url: ""
  return {
    id: item.id,
    kind: classify(item),
    title: item.title,              // may contain HTML entities; decode at render time
    url,
    domain: domainOf(url),
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    author: item.by,
    points: item.score ?? 0,
    comments: item.descendants ?? 0,
    time: item.time ?? 0,           // unix seconds
    hasText: Boolean(item.text),
    rank,
  };
}

export async function fetchFeed(feed = "top", page = 0, { concurrency = 12 } = {}) {
  const path = FEEDS[feed];
  if (!path) throw new Error(`Unknown feed "${feed}"`);
  const ids = (await getJSON(`${HN_BASE}/${path}.json`)) ?? [];
  const start = page * PAGE_SIZE;
  const slice = ids.slice(start, start + PAGE_SIZE);
  const items = await mapLimit(slice, concurrency, id => getJSON(`${HN_BASE}/item/${id}.json`));
  const stories = items.map((it, i) => normalize(it, start + i + 1)).filter(Boolean);
  return { feed, page, total: ids.length, hasMore: start + PAGE_SIZE < ids.length, stories, fetchedAt: new Date().toISOString() };
}
