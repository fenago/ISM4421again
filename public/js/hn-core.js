// Shared HN logic used by both the Netlify Function and the browser fallback.
// Dependency-free, browser-compatible ES module (global fetch / AbortController only).
// See docs/02-endpoints.md, docs/03-data-model.md, docs/05-fetching-patterns.md, docs/07-gotchas-and-edge-cases.md

/**
 * @typedef {Object} HNItem Raw item from /item/{id}.json. Only `id` is guaranteed; unknown fields are tolerated.
 * @property {number} id
 * @property {boolean} [deleted]
 * @property {boolean} [dead]
 * @property {"story"|"comment"|"job"|"poll"|"pollopt"|string} [type]
 * @property {string} [by]
 * @property {number} [time] Unix SECONDS
 * @property {string} [title]
 * @property {string} [text]
 * @property {string} [url] may be "" for jobs
 * @property {number} [score]
 * @property {number} [descendants]
 * @property {number[]} [kids]
 */

/**
 * @typedef {Object} Story
 * @property {number} id
 * @property {"link"|"ask"|"show"|"launch"|"tell"|"job"|"poll"} kind
 * @property {string} title entity-decoded plain text (render as text, never as HTML)
 * @property {string} [url] http(s) only; absent for Ask HN / jobs with url ""
 * @property {string} [domain]
 * @property {string} hnUrl
 * @property {string} [author]
 * @property {number} points
 * @property {number} comments
 * @property {number} time Unix SECONDS (multiply by 1000 for Date)
 * @property {boolean} hasText
 * @property {number} rank 1-based position in the ORIGINAL HN list (not shifted by filtered items)
 */

/**
 * @typedef {Object} FeedPage
 * @property {string} feed
 * @property {number} page
 * @property {number} total ids in the upstream list
 * @property {boolean} hasMore
 * @property {Story[]} stories
 * @property {string} fetchedAt ISO timestamp
 * @property {number} [skipped] items dropped (null/deleted/dead/untitled/failed) from this page
 * @property {boolean} [partial] true if some item fetches failed or the deadline hit
 */

export const HN_BASE = "https://hacker-news.firebaseio.com/v0";
export const FEEDS = {
  top: "topstories", new: "newstories", best: "beststories",
  ask: "askstories", show: "showstories", job: "jobstories",
};
export const PAGE_SIZE = 30;
/** Highest valid page index (500-id cap / 30 per page => pages 0..16). */
export const MAX_PAGE = 16;

/** @param {string} name */
export const isFeed = (name) => typeof name === "string" && Object.prototype.hasOwnProperty.call(FEEDS, name);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status} for ${url}`); this.status = status; }
}
// Retry network errors, timeouts, 5xx and 429. Never retry other 4xx.
const retryable = (e) => !(e instanceof HttpError) || e.status >= 500 || e.status === 429;

/**
 * GET JSON with timeout, jittered exponential backoff and an optional absolute deadline.
 * Returns the parsed body, which is literally `null` for missing items (docs/07).
 * @param {string} url
 * @param {{timeout?: number, retries?: number, deadline?: number}} [opts] deadline = epoch ms
 * @returns {Promise<any>}
 */
export async function getJSON(url, { timeout = 6000, retries = 2, deadline = Infinity } = {}) {
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`deadline exceeded for ${url}`);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(timeout, remaining));
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new HttpError(res.status, url);
      return await res.json();
    } catch (err) {
      const wait = 250 * 2 ** attempt + Math.random() * 150;
      if (attempt >= retries || !retryable(err) || deadline - Date.now() <= wait) throw err;
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Bounded parallel map that preserves input order. A rejected fn yields null for that slot.
 * @template T,R
 * @param {readonly T[]} items
 * @param {number} limit
 * @param {(x:T, i:number)=>Promise<R>} fn
 * @returns {Promise<(R|null)[]>}
 */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length).fill(null);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch { out[i] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
/** Decode HTML entities to plain text without a DOM. Single pass, so "&amp;lt;" -> "&lt;". */
export function decodeEntities(s) {
  return String(s).replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => {
    if (name) return Object.prototype.hasOwnProperty.call(NAMED, name.toLowerCase()) ? NAMED[name.toLowerCase()] : m;
    const cp = hex ? parseInt(hex, 16) : parseInt(dec, 10);
    try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch { return m; }
  });
}

/** @param {HNItem} item @returns {Story["kind"]} */
export function classify(item) {
  if (item.type === "job") return "job";
  if (item.type === "poll") return "poll";
  const t = typeof item.title === "string" ? item.title : "";
  if (/^Show HN:/i.test(t)) return "show";
  if (/^Ask HN:/i.test(t)) return "ask";
  if (/^Launch HN:/i.test(t)) return "launch";
  if (/^Tell HN:/i.test(t)) return "tell";
  // A story that HAD a url is a link even if we later reject that url as unsafe (e.g. javascript:).
  return typeof item.url === "string" && item.url.trim() ? "link" : "ask";
}

/** @param {string} [url] @returns {string|undefined} hostname without leading www. */
export function domainOf(url) {
  if (!url) return undefined;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return undefined; }
}

/** "" / whitespace / non-http(s) / unparsable -> undefined. */
function cleanUrl(raw) {
  if (typeof raw !== "string") return undefined;
  const u = raw.trim();
  if (!u) return undefined;
  try { const p = new URL(u).protocol; return p === "http:" || p === "https:" ? u : undefined; } catch { return undefined; }
}

const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/**
 * Raw HN item -> app Story model (docs/03). Returns null for unusable items:
 * null, deleted, dead, untitled, non story/job/poll types, or missing id.
 * @param {HNItem|null|undefined} item
 * @param {number} rank
 * @returns {Story|null}
 */
export function normalize(item, rank) {
  if (!item || typeof item !== "object" || item.deleted || item.dead) return null;
  if (typeof item.id !== "number" || typeof item.title !== "string" || !item.title.trim()) return null;
  if (item.type && !["story", "job", "poll"].includes(item.type)) return null;
  const url = cleanUrl(item.url);
  return {
    id: item.id,
    kind: classify(item),
    title: decodeEntities(item.title),
    url,
    domain: domainOf(url),
    hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
    author: typeof item.by === "string" ? item.by : undefined, // never lowercased
    points: num(item.score),
    comments: num(item.descendants),
    time: num(item.time),           // unix seconds; convert once at display time
    hasText: Boolean(item.text),
    rank,
  };
}

/**
 * Fetch one page of a feed: list ids, then items with bounded concurrency, order preserved.
 * Per-item failures degrade the page (partial=true); a list failure or total item failure throws.
 * Pages are not backfilled across page boundaries (that would duplicate items on the next page);
 * `rank` stays the original list index + 1 and `skipped` reports how many were dropped.
 * @param {string} [feed]
 * @param {number} [page] 0-based
 * @param {{concurrency?: number, deadlineMs?: number}} [opts] deadlineMs = total time budget
 * @returns {Promise<FeedPage>}
 */
export async function fetchFeed(feed = "top", page = 0, { concurrency = 12, deadlineMs = 8000 } = {}) {
  if (!isFeed(feed)) throw new Error(`Unknown feed "${feed}"`);
  if (!Number.isInteger(page) || page < 0) throw new Error(`Invalid page "${page}"`);
  const deadline = Date.now() + deadlineMs;
  const raw = await getJSON(`${HN_BASE}/${FEEDS[feed]}.json`, { deadline });
  const ids = Array.isArray(raw) ? raw.filter(Number.isInteger) : [];
  const start = page * PAGE_SIZE;
  const slice = ids.slice(start, start + PAGE_SIZE);
  let failures = 0;
  const items = await mapLimit(slice, concurrency, async (id) => {
    try { return await getJSON(`${HN_BASE}/item/${id}.json`, { deadline, retries: 2 }); }
    catch (e) { failures++; throw e; }
  });
  if (slice.length && failures === slice.length) throw new Error("all item fetches failed");
  const stories = [];
  items.forEach((it, i) => { const s = normalize(it, start + i + 1); if (s) stories.push(s); });
  /** @type {FeedPage} */
  const out = {
    feed, page, total: ids.length, hasMore: start + PAGE_SIZE < ids.length,
    stories, fetchedAt: new Date().toISOString(),
  };
  out.skipped = slice.length - stories.length;
  if (failures) out.partial = true;
  return out;
}
