// Tech News Radar - proof-of-concept SPA. Vanilla ES modules, no build step.
// Safety rule: every string reaches the DOM via textContent/setAttribute, EXCEPT
// sanitizeHtml() output for HN/Algolia "text" bodies (see setProse) - the only innerHTML use.
import { FEEDS, HN_BASE, PAGE_SIZE, MAX_PAGE, fetchFeed, getJSON, classify, domainOf } from "./hn-core.js";
import { sanitizeHtml, decodeEntities, safeHttpUrl } from "./sanitize.js";
import { TOPICS, matchesTopic } from "./topics.js";

const ALGOLIA = "https://hn.algolia.com/api/v1";
const FEED_LABELS = { top: "Top", new: "New", best: "Best", ask: "Ask HN", show: "Show HN", job: "Jobs" };
const KIND_LABELS = { ask: "Ask", show: "Show", job: "Job", launch: "Launch", tell: "Tell", poll: "Poll" };
const MAX_COMMENTS = 500;
const POLL_MS = 60_000;
const MAX_SSE_ERRORS = 5;

const $ = (sel) => document.querySelector(sel);
const view = $("#view"), main = $("#main");
const pill = $("#live-pill"), pillBtn = $("#live-refresh");
const statusEl = $("#live-status"), announceEl = $("#live-announce");

// ---------- small helpers ----------
// el("a", {class:"x", href:"..", text:".."}, child...) - text is always set via textContent.
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
}
function ago(sec) {
  if (!sec) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - sec));
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, n] of units) if (s >= n) { const v = Math.floor(s / n); return `${v} ${name}${v > 1 ? "s" : ""} ago`; }
  return "just now";
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
// The single sanctioned innerHTML: sanitized, allow-listed HTML only.
function setProse(node, html) { node.innerHTML = sanitizeHtml(html); }
function setTitle(t) { document.title = t ? `${t} · Tech News Radar` : "Tech News Radar"; }

// ---------- router ----------
let firstRoute = true; // initial page load must NOT steal focus: keyboard users start at the skip link / header
let navToken = 0;     // incremented per navigation; stale async work checks it and bails

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/top";
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { parts, params: new URLSearchParams(query) };
}

async function route() {
  const token = ++navToken;
  const { parts, params } = parseHash();
  stopLive();
  const isCurrent = () => token === navToken;
  let feed = null;

  view.setAttribute("aria-busy", "true");
  view.replaceChildren(el("p", { class: "muted", text: "Loading…" }));
  try {
    if (parts[0] === "item" && /^\d{1,9}$/.test(parts[1] || "")) {
      setTopicsVisible(false);
      await showItem(Number(parts[1]), isCurrent);
    } else if (parts[0] === "search") {
      setTopicsVisible(true);
      await showSearch(params.get("q") || "", params.get("sort") === "date", isCurrent);
    } else {
      feed = FEEDS[parts[0]] ? parts[0] : "top";
      setTopicsVisible(true);
      await showFeed(feed, isCurrent);
    }
  } catch (err) {
    if (isCurrent()) showError(err, () => route());
  }
  if (!isCurrent()) return;
  view.setAttribute("aria-busy", "false");
  document.querySelectorAll(".tabs a").forEach((a) => {
    if (a.dataset.feed === feed) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
  if (!firstRoute) main.focus({ preventScroll: true });   // client-side navigation: move focus to the new content
  firstRoute = false;
  if (feed) startLive(feed);
}

function showError(err, retry) {
  console.error(err);
  const box = el("div", { class: "error", role: "alert" },
    el("p", { text: "Something went wrong loading this page. Please try again." }),
    el("button", { type: "button", text: "Retry" }));
  box.querySelector("button").addEventListener("click", retry);
  view.replaceChildren(box);
  view.setAttribute("aria-busy", "false");
}

// ---------- story list (shared by feeds and search) ----------
// `list` holds everything needed to re-render: loaded stories, paging and a loader.
let list = null;
let topic = "all";

function storyRow(s, isNew) {
  const title = s.title || "(untitled)"; // already plain text (feeds decoded upstream; search hits decoded in mapHit)
  const url = safeHttpUrl(s.url);
  const itemHref = `#/item/${s.id}`;
  const titleLink = url
    ? el("a", { class: "title", href: url, target: "_blank", rel: "noopener noreferrer", text: title })
    : el("a", { class: "title", href: itemHref, text: title });
  const head = el("div", {},
    KIND_LABELS[s.kind] ? el("span", { class: "badge", text: KIND_LABELS[s.kind] }) : null,
    titleLink,
    s.domain ? el("span", { class: "domain", text: `(${s.domain})` }) : null);

  const meta = el("div", { class: "meta" });
  if (s.kind !== "job") meta.append(el("span", { text: plural(s.points ?? 0, "point") }));
  meta.append(el("span", { text: `by ${s.author || "unknown"}` }));
  if (s.time) meta.append(el("span", { text: ago(s.time) }));
  if (s.kind !== "job") meta.append(el("a", { href: itemHref, text: plural(s.comments ?? 0, "comment") }));
  meta.append(el("a", { href: s.hnUrl, target: "_blank", rel: "noopener noreferrer", "aria-label": `Discuss "${title}" on Hacker News`, text: "HN" }));

  return el("li", { class: "story" + (isNew ? " is-new" : ""), "data-id": s.id },
    el("span", { class: "rank", "aria-hidden": "true", text: s.rank ? `${s.rank}.` : "" }), head, meta);
}

function visibleStories() {
  return list.stories.filter((s) => matchesTopic(s, topic, s.title));
}

function renderList(focusId) {
  const shown = visibleStories();
  const frag = document.createDocumentFragment();
  if (list.headerNode) frag.append(list.headerNode);
  if (topic !== "all") frag.append(el("p", { class: "muted", text: "Filtering loaded stories — load more to see more" }));
  if (!shown.length) {
    frag.append(el("p", { class: "empty", text: list.stories.length ? "No loaded stories match this topic." : "Nothing to show here yet." }));
  } else {
    const ol = el("ol", { class: "stories", "aria-label": list.title });
    for (const s of shown) ol.append(storyRow(s, list.newIds.has(s.id)));
    frag.append(ol);
  }
  if (list.hasMore) {
    const btn = el("button", { type: "button", class: "secondary", text: list.loadingMore ? "Loading…" : "Load more" });
    if (list.loadingMore) btn.disabled = true;
    btn.addEventListener("click", loadMore);
    frag.append(el("div", { class: "more" }, btn));
  }
  if (list.moreError) frag.append(el("p", { class: "error", role: "alert", text: "Couldn't load more. Try again." }));
  view.replaceChildren(frag);
  if (focusId != null) view.querySelector(`.story[data-id="${focusId}"] a.title`)?.focus();
}

async function loadMore() {
  const l = list;
  l.loadingMore = true; l.moreError = false; renderList();
  try {
    const res = await l.load(l.page + 1);
    if (list !== l) return;                       // user navigated away
    l.page += 1; l.hasMore = res.hasMore && l.page < MAX_PAGE;
    const have = new Set(l.stories.map((s) => s.id));
    const added = res.stories.filter((s) => !have.has(s.id));
    l.stories.push(...added);
    l.loadingMore = false; l.moreError = false;
    const first = added.find((s) => matchesTopic(s, topic, s.title));
    renderList(first?.id);                        // keep keyboard users where the new rows begin
  } catch (err) {
    console.error(err);
    if (list !== l) return;
    l.loadingMore = false; l.moreError = true; renderList();
  }
}

function setTopicsVisible(on) { $("#topics").hidden = !on; }

function initTopics() {
  const box = $("#topics");
  for (const t of TOPICS) {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(t.id === topic), "data-topic": t.id, text: t.label });
    b.addEventListener("click", () => {
      topic = t.id;
      box.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.topic === topic)));
      if (list) renderList();
    });
    box.append(b);
  }
}

// ---------- feeds ----------
// Prefer our cached Netlify Function; fall back to hitting HN directly (e.g. static preview).
async function loadFeedPage(feed, page) {
  try {
    const res = await fetch(`/api/feed/${feed}?page=${page}`, { headers: { accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.stories)) return data;
    }
  } catch { /* fall through to direct */ }
  return fetchFeed(feed, page);
}

async function showFeed(feed, isCurrent, markNew = new Set()) {
  const data = await loadFeedPage(feed, 0);
  if (!isCurrent()) return;
  setTitle(FEED_LABELS[feed]);
  list = {
    kind: "feed", feed, title: `${FEED_LABELS[feed]} stories`, page: 0, hasMore: data.hasMore,
    stories: data.stories, pageIds: data.ids || [], newIds: markNew, load: (p) => loadFeedPage(feed, p),
    headerNode: el("h1", { class: "sr-only", text: `${FEED_LABELS[feed]} stories` }),
  };
  renderList();
}

// ---------- live updates (SSE with polling fallback) ----------
const live = { feed: null, es: null, gen: 0, errors: 0, ids: [], pollTimer: null, reconnectTimer: null, updateTimer: null, lastCount: 0, polling: false };

function setStatus(t) { statusEl.textContent = t; }   // #live-status is aria-live="off": no chatter

function startLive(feed) {
  stopLive();
  live.feed = feed; live.errors = 0; live.ids = []; live.polling = false; live.lastCount = 0;
  if (document.hidden) { setStatus("Live updates paused"); return; }
  openStream();
}

function stopLive() {
  live.gen++;                                      // invalidates handlers of any stream being closed
  live.es?.close(); live.es = null;
  clearTimeout(live.reconnectTimer); clearInterval(live.pollTimer); clearTimeout(live.updateTimer);
  live.pollTimer = null;
  live.feed = null; live.polling = false;
  hidePill(); setStatus("");
}

function openStream() {
  if (!live.feed || live.es || live.polling) return;
  const gen = ++live.gen;
  let es;
  try { es = new EventSource(`${HN_BASE}/${FEEDS[live.feed]}.json`); } catch { return startPolling(); }
  live.es = es;
  setStatus("Reconnecting…");
  const ok = (fn) => (e) => { if (gen === live.gen) fn(e); };   // ignore events from stale streams
  es.addEventListener("put", ok((e) => { live.errors = 0; setStatus("Live"); applyEvent(e.data); }));
  es.addEventListener("patch", ok((e) => applyEvent(e.data)));
  // keep-alive carries no data and is deliberately not handled.
  es.addEventListener("cancel", ok(() => {
    es.close(); live.es = null; setStatus("Reconnecting…");
    live.reconnectTimer = setTimeout(openStream, 3000);
  }));
  es.onerror = ok(() => {
    setStatus("Reconnecting…");
    if (++live.errors >= MAX_SSE_ERRORS) { es.close(); live.es = null; startPolling(); }
  });
}

// Firebase REST streaming: put replaces the value at path, patch merges children under path.
function applyEvent(raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  if (!msg || typeof msg.path !== "string") return;
  const { path, data } = msg;
  if (path === "/") {
    if (Array.isArray(data)) live.ids = data.slice();
    else if (data && typeof data === "object") {           // patch: { "3": id, ... }
      const next = live.ids.slice();
      for (const [i, id] of Object.entries(data)) if (Number.isInteger(+i)) next[+i] = id;
      live.ids = next.filter((x) => x != null);
    }
  } else {
    const idx = Number(path.slice(1));                     // "/3" with a scalar id
    if (Number.isInteger(idx) && idx >= 0 && typeof data === "number") live.ids[idx] = data;
  }
  scheduleLiveUpdate();
}

function startPolling() {
  live.polling = true;
  setStatus("Live updates paused — checking every minute");
  const poll = async () => {
    const feed = live.feed, gen = live.gen;
    try {
      const data = await loadFeedPage(feed, 0);
      if (gen !== live.gen) return;
      live.ids = data.ids || data.stories.map((s) => s.id);
      scheduleLiveUpdate();
    } catch (err) { console.error(err); }
  };
  clearInterval(live.pollTimer);
  live.pollTimer = setInterval(poll, POLL_MS);
}

// Throttled (2 s trailing) so bursts of patches yield one pill update.
function scheduleLiveUpdate() {
  if (live.updateTimer) return;
  live.updateTimer = setTimeout(() => { live.updateTimer = null; updatePill(); }, 2000);
}

// Ids the user already has: rendered stories PLUS ids the server dropped (dead/deleted/null), which must not count as "new".
function seenIds() { return new Set([...(list.pageIds || []), ...list.stories.map((s) => s.id)]); }

function updatePill() {
  if (!list || list.feed !== live.feed) return;
  const shown = seenIds();
  const count = live.ids.slice(0, PAGE_SIZE).filter((id) => !shown.has(id)).length;
  if (count === live.lastCount) return;                    // nothing changed: no DOM churn, no announcement
  live.lastCount = count;
  if (!count) return hidePill();
  pillBtn.textContent = `${plural(count, "new story").replace("storys", "stories")} — show`;
  pill.hidden = false;
  announceEl.textContent = `${count} new ${count === 1 ? "story" : "stories"} available`;
}

function hidePill() { pill.hidden = true; announceEl.textContent = ""; live.lastCount = 0; }

pillBtn.addEventListener("click", async () => {
  if (!list || list.kind !== "feed") return;
  const feed = list.feed, token = navToken;
  const shown = seenIds();
  const fresh = new Set(live.ids.slice(0, PAGE_SIZE).filter((id) => !shown.has(id)));
  view.setAttribute("aria-busy", "true");
  try {
    await showFeed(feed, () => token === navToken, fresh);
    hidePill();
    window.scrollTo(0, 0);
    view.querySelector(".story a.title")?.focus();
  } catch (err) { console.error(err); }
  view.setAttribute("aria-busy", "false");
});

// Close streams while the tab is hidden; reopen when it comes back.
document.addEventListener("visibilitychange", () => {
  if (!live.feed) return;
  if (document.hidden) {
    live.gen++; live.es?.close(); live.es = null;
    clearTimeout(live.reconnectTimer); clearInterval(live.pollTimer); live.pollTimer = null;
    setStatus("Live updates paused");
  } else {
    live.errors = 0;
    if (live.polling) startPolling(); else openStream();
  }
});

// ---------- item view ----------
async function fetchItem(id) {
  try {
    const it = await getJSON(`${ALGOLIA}/items/${id}`, { retries: 1 });
    if (it && it.id) return { full: true, item: it };
  } catch { /* fall back to Firebase header-only */ }
  const raw = await getJSON(`${HN_BASE}/item/${id}.json`);
  if (!raw) return null;
  return { full: false, item: { id: raw.id, title: raw.title, url: raw.url, text: raw.text, author: raw.by, points: raw.score,
    created_at_i: raw.time, descendants: raw.descendants, children: [] } };
}

function countReplies(c) { return (c.children || []).reduce((n, k) => n + 1 + countReplies(k), 0); }

function renderComment(c, ctx) {
  if (ctx.count >= MAX_COMMENTS) { ctx.truncated = true; return null; }
  ctx.count++;
  const gone = !c.author || c.text == null;                // deleted/dead: show placeholder but keep children
  const replies = countReplies(c);
  const summary = el("summary", {},
    el("span", { class: "author", text: gone ? "[deleted]" : c.author }),
    ` · ${ago(c.created_at_i)}${replies ? ` · ${plural(replies, "reply").replace("replys", "replies")}` : ""}`);
  const d = el("details", { class: "comment", open: true }, summary);
  if (!gone) { const body = el("div", { class: "prose" }); setProse(body, c.text); d.append(body); }
  for (const k of c.children || []) { const n = renderComment(k, ctx); if (n) d.append(n); }
  return d;
}

async function showItem(id, isCurrent) {
  const res = await fetchItem(id);
  if (!isCurrent()) return;
  list = null; hidePill();
  const hnUrl = `https://news.ycombinator.com/item?id=${id}`;
  if (!res) { view.replaceChildren(el("p", { class: "empty", text: "This item doesn't exist or was removed." })); return; }
  const it = res.item;
  const title = decodeEntities(it.title) || `Comment by ${it.author || "unknown"}`;
  setTitle(title);

  const url = safeHttpUrl(it.url);
  const head = el("article", { class: "item-head" }, el("h1", { text: title }));
  if (url) head.append(el("p", {}, el("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: url }),
    domainOf(url) ? el("span", { class: "domain", text: `(${domainOf(url)})` }) : null));
  head.append(el("div", { class: "meta" },
    it.points != null ? el("span", { text: plural(it.points, "point") }) : null,
    el("span", { text: `by ${it.author || "unknown"}` }),
    el("span", { text: ago(it.created_at_i) }),
    el("a", { href: hnUrl, target: "_blank", rel: "noopener noreferrer", text: "View on Hacker News" })));
  if (it.text) { const p = el("div", { class: "prose" }); setProse(p, it.text); head.append(p); }

  const frag = document.createDocumentFragment();
  frag.append(el("p", {}, el("a", { href: "#/top", text: "← Back to Top" })), head);

  const section = el("section", { class: "comments", "aria-label": "Comments" });
  if (!res.full) {
    section.append(el("p", { class: "empty", text: "Comments are unavailable right now." },), el("p", {}, el("a", { href: hnUrl, target: "_blank", rel: "noopener noreferrer", text: "Read the discussion on Hacker News" })));
  } else if (!(it.children || []).length) {
    section.append(el("p", { class: "empty", text: "No comments yet." }));
  } else {
    section.append(el("h2", { text: "Comments" }));
    const ctx = { count: 0, truncated: false };
    for (const c of it.children) { const n = renderComment(c, ctx); if (n) section.append(n); }
    if (ctx.truncated) section.append(el("p", { class: "muted" },
      `Showing the first ${MAX_COMMENTS} comments. `,
      el("a", { href: hnUrl, target: "_blank", rel: "noopener noreferrer", text: "Continue on Hacker News" })));
  }
  frag.append(section);
  view.replaceChildren(frag);
}

// ---------- search ----------
function mapHit(h, i) {
  const id = Number(h.objectID);
  return {
    id, kind: classify({ type: "story", title: h.title || "", url: h.url }), title: decodeEntities(h.title || ""),
    url: h.url || undefined, domain: domainOf(h.url), hnUrl: `https://news.ycombinator.com/item?id=${id}`,
    author: h.author, points: h.points ?? 0, comments: h.num_comments ?? 0, time: h.created_at_i ?? 0, rank: i,
  };
}

async function showSearch(q, byDate, isCurrent) {
  $("#q").value = q;
  setTitle(q ? `Search: ${q}` : "Search");
  if (!q.trim()) { list = null; hidePill(); view.replaceChildren(el("p", { class: "empty", text: "Type a query above to search stories." })); return; }
  const endpoint = byDate ? "search_by_date" : "search";
  const load = async (page) => {
    const qs = new URLSearchParams({ query: q, tags: "story", hitsPerPage: String(PAGE_SIZE), page: String(page) });
    const data = await getJSON(`${ALGOLIA}/${endpoint}?${qs}`, { retries: 1 });
    const hits = data?.hits || [];
    return { stories: hits.map((h, i) => mapHit(h, page * PAGE_SIZE + i + 1)), hasMore: page + 1 < Math.min(data?.nbPages || 0, MAX_PAGE + 1) };
  };
  const first = await load(0);
  if (!isCurrent()) return;

  const sel = el("select", { id: "sort" },
    el("option", { value: "relevance", text: "Most relevant" }), el("option", { value: "date", text: "Newest" }));
  sel.value = byDate ? "date" : "relevance";
  sel.addEventListener("change", () => {
    location.hash = `#/search?q=${encodeURIComponent(q)}${sel.value === "date" ? "&sort=date" : ""}`;
  });
  const header = el("div", {}, el("h1", { class: "sr-only", text: `Search results for ${q}` }),
    el("p", { class: "meta" }, el("label", { for: "sort", text: "Sort by " }), sel));
  list = { kind: "search", feed: null, title: `Search results for ${q}`, page: 0, hasMore: first.hasMore,
    stories: first.stories, newIds: new Set(), load, headerNode: header };
  renderList();
  if (!first.stories.length) view.querySelector(".empty").textContent = `No stories found for "${q}".`;
}

// ---------- boot ----------
$("#search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#q").value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : "#/top";
});
window.addEventListener("hashchange", route);
initTopics();
route();
