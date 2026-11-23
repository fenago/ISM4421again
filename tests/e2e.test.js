// End-to-end tests: real Chromium (Playwright library, preinstalled globally) against public/ served with the
// CSP from netlify.toml. HN, Algolia and EventSource are fully mocked; nothing here touches the network.
// Skips gracefully when Playwright/Chromium is unavailable. Run: npm test
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { startAppServer } from "./helpers/app-server.js";
import { makeHnState, makeFetchStub, hnLookup } from "./helpers/fixtures.js";
import { makeAlgoliaState } from "./helpers/algolia.js";

// ESM `import "playwright"` does not honour NODE_PATH, so resolve it with require.
let chromium = null, skipReason = null;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch (e) { skipReason = `playwright not importable: ${e.message}`; }

const payloads = JSON.parse(readFileSync(new URL("./sanitize.payloads.json", import.meta.url), "utf8"));
const FAKE_ES = `(() => {
  window.__es = [];
  class FakeES extends EventTarget {
    constructor(url) { super(); this.url = url; this.closed = false; this.onerror = null; window.__es.push(this); }
    close() { this.closed = true; }
    __emit(type, data) { this.dispatchEvent(new MessageEvent(type, { data: typeof data === "string" ? data : JSON.stringify(data) })); }
    __error() { const e = new Event("error"); if (this.onerror) this.onerror(e); this.dispatchEvent(e); }
  }
  window.EventSource = FakeES;
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
})();`;

const CORS = { "access-control-allow-origin": "*", "content-type": "application/json" };
const realFetch = globalThis.fetch;
const T = (n) => 50700000 + n;

describe("e2e (Chromium, mocked network)", { skip: skipReason ?? false }, () => {
  let server, browser, env;

  before(async () => {
    server = await startAppServer();
    try { browser = await chromium.launch(); }
    catch (e) { skipReason = `chromium launch failed: ${e.message}`; }
    // Function handler (server side) uses global fetch -> serve HN fixtures from the CURRENT env.
    globalThis.fetch = (input, init) => makeFetchStub(env.hn)(input, init);
  });
  after(async () => { globalThis.fetch = realFetch; await browser?.close(); await server?.close(); });

  /** Open a fresh page. Returns helpers plus a monitor of everything that must stay empty. */
  async function open(t, hash = "#/top", { viewport = { width: 1280, height: 800 }, clock = false } = {}) {
    if (!browser) return t.skip(skipReason);
    env = { hn: makeHnState(), alg: makeAlgoliaState(), leaks: [], errors: [] };
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    t.after(() => ctx.close());
    // Anything not served by us / HN / Algolia mocks is a leak (live network) and is aborted.
    await ctx.route((u) => !u.href.startsWith(server.base) && u.protocol.startsWith("http"), (r) => { env.leaks.push(r.request().url()); r.abort(); });
    await ctx.route(/^https:\/\/hacker-news\.firebaseio\.com\//, (r) => {
      const { status, body } = hnLookup(env.hn, r.request().url());
      r.fulfill({ status, headers: CORS, body: JSON.stringify(body) });
    });
    await ctx.route(/^https:\/\/hn\.algolia\.com\//, (r) => {
      const u = new URL(r.request().url()); env.alg.log.push(u.pathname + u.search);
      const im = u.pathname.match(/\/items\/(\d+)$/);
      if (im) {
        const it = env.alg.items[im[1]];
        return r.fulfill({ status: it ? 200 : 404, headers: CORS, body: JSON.stringify(it ?? { status: 404, error: "not found" }) });
      }
      const m = u.pathname.match(/\/(search|search_by_date)$/);
      if (m) return r.fulfill({ status: 200, headers: CORS, body: JSON.stringify(env.alg.search(u.searchParams.get("query"), m[1], Number(u.searchParams.get("page")))) });
      r.fulfill({ status: 404, headers: CORS, body: "{}" });
    });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") env.errors.push(`console.${m.type()}: ${m.text()}`); });
    page.on("pageerror", (e) => env.errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(FAKE_ES);
    if (clock) await page.clock.install();
    await page.goto(`${server.base}/${hash}`);
    await page.waitForFunction(() => document.querySelector("#view")?.getAttribute("aria-busy") === "false");
    const api = {
      page, ctx,
      rows: () => page.locator("#view .story"),
      titles: () => page.locator("#view .story .title").allTextContents(),
      /** emit an SSE event on the newest open fake stream */
      emit: (type, data) => page.evaluate(([ty, d]) => { const l = window.__es.filter((e) => !e.closed); l[l.length - 1].__emit(ty, d); }, [type, data]),
      streamUrls: () => page.evaluate(() => window.__es.map((e) => e.url + (e.closed ? " (closed)" : ""))),
      openStreams: () => page.evaluate(() => window.__es.filter((e) => !e.closed).length),
      /** every test must end clean: no console errors, no CSP violations, no live-network leaks */
      // hostile=true: tests that feed attack markup through the sanitizer. Chromium reports CSP violations for inline
      // handlers/styles/<base> merely PARSED by the sanitizer's inert DOMParser (nothing executes, output is clean).
      // Tolerate exactly those report-only classes; any script-src/default-src/connect-src violation still fails.
      async assertClean({ hostile = false } = {}) {
        let csp = await page.evaluate(() => window.__csp);
        if (hostile) csp = csp.filter((v) => !/^(script-src-attr|style-src-attr|style-src-elem|base-uri) /.test(v));
        assert.deepEqual(csp, [], "CSP violations");
        if (hostile) env.errors = env.errors.filter((e) => !/violates the following Content Security Policy directive.*(inline|base-uri)|Setting the document's base URI/s.test(e));
        assert.deepEqual(env.errors, [], "console errors / page errors");
        assert.deepEqual(env.leaks, [], "unmocked external requests");
      },
    };
    return api;
  }
  const waitStream = (a) => a.page.waitForFunction(() => window.__es.some((e) => !e.closed));
  const TOP30 = () => makeHnState().lists.topstories.slice(0, 30);

  test("server applies the CSP from netlify.toml", () => {
    assert.match(server.csp, /script-src 'self'/);
    assert.match(server.csp, /connect-src[^;]*hacker-news\.firebaseio\.com/);
  });

  test("feed renders 25 usable rows in rank order; entities decoded once; bad items hidden", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    assert.equal(await a.rows().count(), 25);
    const titles = await a.titles();
    assert.equal(titles[0], `Why Rust & Go: it's "fast" <3`, "decoded exactly once, shown as text");
    assert.equal(await page.locator("#view .story .title >> text=<3").count(), 1);
    // dead (6), deleted (7), null (8), untitled (9), comment (14) never appear
    for (const id of [6, 7, 8, 9, 14]) assert.equal(await page.locator(`.story[data-id="${T(id)}"]`).count(), 0, `item ${id} hidden`);
    assert.ok(!titles.some((x) => /Buy cheap watches/.test(x)));
    // original ranks preserved, not renumbered after filtering (rank of id T(10) is 10)
    assert.equal(await page.locator(`.story[data-id="${T(10)}"] .rank`).textContent(), "10.");
    assert.equal(await page.locator(`.story[data-id="${T(15)}"] .rank`).textContent(), "15.");
    // metadata + attribution
    const first = page.locator(".story").first();
    assert.match(await first.locator(".meta").innerText(), /512 points\s+by pg\s+.*ago\s+301 comments\s+HN/s);
    assert.equal(await first.locator(".domain").textContent(), "(example.com)");
    assert.equal(await first.locator("a.title").getAttribute("href"), "https://www.example.com/rust-go");
    assert.equal(await first.locator("a.title").getAttribute("rel"), "noopener noreferrer");
    assert.equal(await first.locator('a[href^="https://news.ycombinator.com/item?id="]').getAttribute("href"), "https://news.ycombinator.com/item?id=50700001");
    // every row links to HN discussion
    assert.equal(await page.locator('.story a[href^="https://news.ycombinator.com/item?id="]').count(), 25);
    // kind badges
    const badge = (n) => page.locator(`.story[data-id="${T(n)}"] .badge`).textContent();
    assert.equal(await badge(2), "Ask"); assert.equal(await badge(3), "Show"); assert.equal(await badge(4), "Job");
    assert.equal(await badge(5), "Poll"); assert.equal(await badge(10), "Tell"); assert.equal(await badge(11), "Launch");
    assert.equal(await page.locator(`.story[data-id="${T(1)}"] .badge`).count(), 0);
    // job in /topstories: labeled, no points, no comments link, title links to item view (url was "")
    const job = page.locator(`.story[data-id="${T(4)}"]`);
    assert.doesNotMatch(await job.innerText(), /point|comment/i);
    assert.equal(await job.locator("a.title").getAttribute("href"), `#/item/${T(4)}`);
    // Ask HN has no external url: title goes to item view, no domain
    assert.equal(await page.locator(`.story[data-id="${T(2)}"] a.title`).getAttribute("href"), `#/item/${T(2)}`);
    assert.equal(await page.locator(`.story[data-id="${T(2)}"] .domain`).count(), 0);
    // javascript: url must never become an href, anywhere
    assert.equal(await page.locator(`.story[data-id="${T(13)}"] a.title`).getAttribute("href"), `#/item/${T(13)}`);
    assert.equal(await page.locator('a[href^="javascript" i]').count(), 0);
    // singular/plural
    assert.match(await page.locator(`.story[data-id="${T(30)}"] .meta`).innerText(), /71 points.*1 comment(?!s)/s);
    // semantics
    assert.equal(await page.locator("ol.stories").count(), 1);
    assert.equal(await page.locator("main h1").count(), 1);
    assert.equal(await page.locator('.tabs a[aria-current="page"]').textContent(), "Top");
    await a.assertClean();
  });

  test("tabs switch, set aria-current, and load their own feed (New, Ask, Jobs)", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    await page.click('.tabs a[data-feed="new"]');
    await page.waitForFunction(() => document.querySelectorAll("#view .story").length === 5);
    assert.equal(await page.locator('.tabs a[aria-current="page"]').count(), 1);
    assert.equal(await page.locator('.tabs a[aria-current="page"]').textContent(), "New");
    assert.deepEqual((await a.titles())[0], "Poll: Tabs or spaces?");
    assert.equal(await page.title(), "New · Tech News Radar");
    await page.click('.tabs a[data-feed="ask"]');
    await page.waitForFunction(() => document.querySelectorAll("#view .story").length === 1 && document.querySelector(".story .badge")?.textContent === "Ask");
    await page.click('.tabs a[data-feed="job"]');
    await page.waitForFunction(() => document.querySelector(".story .badge")?.textContent === "Job");
    assert.equal(await page.locator('.tabs a[aria-current="page"]').textContent(), "Jobs");
    assert.doesNotMatch(await page.locator(".story").first().innerText(), /point/i);
    // live stream follows the tab: the stream URL is .json (suffix required) and old ones are closed
    const urls = await a.streamUrls();
    assert.ok(urls.every((u) => u.includes(".json")), urls.join());
    assert.equal(await a.openStreams(), 1);
    assert.match(urls.at(-1), /jobstories\.json$/);
    // unknown route falls back to Top rather than crashing
    await page.goto(`${server.base}/#/bogus`);
    await page.waitForSelector(".story");
    assert.equal(await page.locator('.tabs a[aria-current="page"]').textContent(), "Top");
    await a.assertClean();
  });

  test("topic chip filters loaded stories and can be cleared", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    assert.equal(await page.locator('.chip[aria-pressed="true"]').textContent(), "All");
    await page.click('.chip[data-topic="programming"]');
    const ids = await page.$$eval(".story", (n) => n.map((x) => Number(x.dataset.id)));
    assert.ok(ids.includes(T(1)), "Rust title matches");
    assert.ok(ids.includes(T(3)), "github.com domain matches");
    assert.ok(ids.includes(T(10)), "'API' matches");
    assert.ok(!ids.includes(T(15)), "plain story filtered out");
    assert.ok(ids.length < 25);
    assert.equal(await page.locator('.chip[aria-pressed="true"]').textContent(), "Programming");
    assert.equal(await page.locator('.chip[aria-pressed="true"]').count(), 1);
    await page.click('.chip[data-topic="startups"]');
    assert.ok((await page.$$eval(".story", (n) => n.map((x) => Number(x.dataset.id)))).includes(T(4)), "YC job matches startups");
    await page.click('.chip[data-topic="all"]');
    assert.equal(await a.rows().count(), 25);
    await a.assertClean();
  });

  test("Load more appends page 2 (ranks 31-35), no duplicates, then the button disappears", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    await page.click("button:has-text('Load more')");
    await page.waitForFunction(() => document.querySelectorAll("#view .story").length === 30);
    const ids = await page.$$eval(".story", (n) => n.map((x) => x.dataset.id));
    assert.equal(new Set(ids).size, 30);
    assert.deepEqual(await page.$$eval(".story .rank", (n) => n.slice(-5).map((x) => x.textContent)), ["31.", "32.", "33.", "34.", "35."]);
    assert.equal(await page.locator("button:has-text('Load more')").count(), 0);
    // focus moved to first newly loaded row (keyboard users)
    assert.equal(await page.evaluate(() => document.activeElement?.closest(".story")?.dataset.id), String(T(31)));
    await a.assertClean();
  });

  test("Load more failure shows an alert and keeps loaded rows", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    await page.route("**/api/feed/top?page=1", (r) => r.fulfill({ status: 502, body: '{"error":"x"}', contentType: "application/json" }));
    await page.route(/hacker-news\.firebaseio\.com\/v0\/topstories/, (r) => r.abort());
    await page.click("button:has-text('Load more')");
    await page.waitForSelector("p.error[role=alert]");
    assert.equal(await a.rows().count(), 25);
    // expected failures log to console.error; only those are allowed
    env.errors = env.errors.filter((e) => !/Failed to load resource|ERR_FAILED|TypeError|HTTP|fetch/i.test(e));
    env.leaks = [];
    await a.assertClean();
  });

  test("live: initial put with the same ids shows NO pill (filtered/dead ids are not 'new')", async (t) => {
    const a = await open(t); if (!a) return;
    await waitStream(a);
    await a.emit("put", { path: "/", data: TOP30() });          // includes dead/deleted/null/comment ids
    await a.page.waitForTimeout(2600);                          // throttle is 2s
    assert.equal(await a.page.locator("#live-pill").isHidden(), true, `pill text: ${await a.page.locator("#live-refresh").textContent()}`);
    assert.equal(await a.page.locator("#live-status").textContent(), "Live");
    await a.assertClean();
  });

  test("live: patch adds new ids -> pill (no reorder) -> click reloads with .is-new and focus", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    await waitStream(a);
    assert.match((await a.streamUrls())[0], /^https:\/\/hacker-news\.firebaseio\.com\/v0\/topstories\.json$/);
    await a.emit("put", { path: "/", data: TOP30() });
    const before = await a.titles();
    // keep-alive must be ignored (no data, must not throw)
    await a.emit("keep-alive", "null");
    // two fresh stories appear on HN; the next feed fetch will include them
    state_addFresh(env);
    await a.emit("patch", { path: "/", data: { 0: 50709998, 1: 50709999 } });
    await page.waitForSelector("#live-pill:not([hidden])", { timeout: 6000 });
    assert.equal(await page.locator("#live-refresh").textContent(), "2 new stories — show");
    assert.equal(await page.locator("#live-announce").textContent(), "2 new stories available");
    assert.equal(await page.locator("#live-announce").getAttribute("aria-live"), "polite");
    assert.deepEqual(await a.titles(), before, "list must not reorder until the user asks");
    await page.click("#live-refresh");
    await page.waitForSelector(".story.is-new");
    const fresh = await page.$$eval(".story.is-new", (n) => n.map((x) => x.dataset.id));
    assert.deepEqual(fresh.sort(), ["50709998", "50709999"]);
    assert.equal((await a.titles())[0], "Fresh story B");
    assert.equal(await page.locator("#live-pill").isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement?.className), "title");
    // a single new story is singular (resync our fake stream with the new list first)
    await a.emit("put", { path: "/", data: env.hn.lists.topstories.slice(0, 30) });
    state_addFresh(env, 50709997);
    await a.emit("patch", { path: "/", data: { 0: 50709997 } });
    await page.waitForFunction(() => /^1 new story — show$/.test(document.querySelector("#live-refresh").textContent), null, { timeout: 6000 });
    await a.assertClean();
  });

  test("live: '/3' scalar path puts, bursts coalesce into one update, cancel reconnects", async (t) => {
    const a = await open(t, "#/top", { clock: true }); if (!a) return;
    const { page } = a;
    await waitStream(a);
    await a.emit("put", { path: "/", data: TOP30() });
    state_addFresh(env);
    await a.emit("patch", { path: "/3", data: 50709999 });      // scalar at "/3" form
    await a.emit("patch", { path: "/", data: { 4: 50709998 } });
    await page.clock.fastForward(2100);
    await page.waitForFunction(() => /^2 new stories/.test(document.querySelector("#live-refresh").textContent));
    // server cancels the stream: app closes it and reopens after 3 s
    const n0 = (await a.streamUrls()).length;
    await a.emit("cancel", "permission denied");
    assert.equal(await a.openStreams(), 0);
    await page.clock.fastForward(3100);
    await page.waitForFunction((n) => window.__es.length === n + 1 && !window.__es.at(-1).closed, n0);
    assert.equal(await page.locator("#live-status").textContent(), "Reconnecting…");
    await a.emit("put", { path: "/", data: TOP30() });
    assert.equal(await page.locator("#live-status").textContent(), "Live");
    await a.assertClean();
  });

  test("live: 5 stream errors -> polling fallback every 60 s still surfaces new stories", async (t) => {
    const a = await open(t, "#/top", { clock: true }); if (!a) return;
    const { page } = a;
    await waitStream(a);
    for (let i = 0; i < 5; i++) await page.evaluate(() => window.__es.filter((e) => !e.closed).at(-1)?.__error());
    assert.equal(await a.openStreams(), 0, "stream closed after 5 errors");
    assert.match(await page.locator("#live-status").textContent(), /checking every minute/);
    state_addFresh(env);
    await page.clock.fastForward(61_000);
    await page.clock.fastForward(2_100);
    await page.waitForSelector("#live-pill:not([hidden])");
    assert.match(await page.locator("#live-refresh").textContent(), /^2 new stories/);
    await a.assertClean();
  });

  test("item view: sanitized comment tree, [deleted] placeholder keeps replies, attribution links", async (t) => {
    const a = await open(t, `#/item/${T(1)}`); if (!a) return;
    const { page } = a;
    await page.waitForSelector(".comment");
    assert.equal(await page.locator("h1").textContent(), `Why Rust & Go: it's "fast" <3`);
    assert.equal(await page.title(), `Why Rust & Go: it's "fast" <3 · Tech News Radar`);
    assert.equal(await page.locator('.item-head a[href="https://news.ycombinator.com/item?id=50700001"]').count(), 1);
    assert.equal(await page.locator('.item-head a[href="https://www.example.com/rust-go"]').count(), 1);
    // order preserved: alice, deleted, mallory at top level
    const topAuthors = await page.$$eval(".comments > details.comment > summary .author", (n) => n.map((x) => x.textContent));
    assert.deepEqual(topAuthors, ["alice", "[deleted]", "mallory"]);
    // deleted parent keeps its reply visible; no body rendered for it
    const deleted = page.locator(".comments > details.comment").nth(1);
    assert.match(await deleted.locator("summary").first().innerText(), /\[deleted\].*1 reply/);
    assert.equal(await deleted.locator(":scope > .prose").count(), 0);
    assert.equal(await deleted.locator("details.comment .author").textContent(), "carol");
    // username case preserved; reply counts; <p> separators -> two paragraphs; entities decoded in body
    assert.equal(await page.locator("details.comment details.comment .author").first().textContent(), "Bob_MiXed");
    const alice = page.locator(".comments > details.comment").first();
    assert.equal(await alice.locator(":scope > .prose p").count(), 1, "unclosed <p> separator: bare first paragraph + one <p>");
    assert.match(await alice.locator(":scope > .prose").innerText(), /^First para\s+Second para/);
    assert.match(await alice.locator(":scope > .prose").innerText(), /it's > fine & ok/);
    const link = alice.locator(":scope > .prose a");
    assert.equal(await link.getAttribute("href"), "https://example.com/very/long/path?x=1", "full href kept");
    assert.match(await link.textContent(), /\.\.\.$/, "truncated link text kept");
    assert.match(await link.getAttribute("rel"), /noopener/); assert.equal(await link.getAttribute("target"), "_blank");
    // XSS comment: sanitized
    const mal = page.locator(".comments > details.comment").nth(2);
    const html = await mal.locator(":scope > .prose").innerHTML();
    assert.doesNotMatch(html, /<script|<img|<svg|onerror|onload|javascript:/i);
    assert.match(html, /evil link/); assert.match(html, /safe tail/);
    assert.equal(await mal.locator("a").count(), 0, "javascript: link unwrapped");
    assert.equal(await page.evaluate(() => window.__pwn), undefined, "no payload executed");
    assert.equal(await page.locator(".comments script, .comments img, .comments svg").count(), 0);
    // comments are collapsible natively
    await alice.locator("summary").first().click();
    assert.equal(await alice.getAttribute("open"), null);
    await a.assertClean({ hostile: true });
  });

  test("item view: Ask HN text sanitized; no comments message; null item; Algolia down falls back to header-only", async (t) => {
    const a = await open(t, `#/item/${T(2)}`); if (!a) return;
    const { page } = a;
    await page.waitForSelector(".item-head .prose");
    assert.equal(await page.locator(".item-head .prose p").count(), 1, "bare text then one <p>Anything.");
    assert.equal(await page.locator(".comments .empty").textContent(), "No comments yet.");
    // null item (HTTP 200 + literal null from HN, 404 from Algolia)
    await page.goto(`${server.base}/#/item/${T(8)}`);
    await page.waitForSelector(".empty");
    assert.match(await page.locator(".empty").textContent(), /doesn't exist/);
    // Algolia has no tree for 50700003 -> Firebase header-only fallback
    await page.goto(`${server.base}/#/item/${T(3)}`);
    await page.waitForSelector(".comments .empty");
    assert.match(await page.locator(".comments").innerText(), /Comments are unavailable/);
    assert.equal(await page.locator('.comments a[href="https://news.ycombinator.com/item?id=50700003"]').count(), 1);
    assert.equal(await page.locator("h1").textContent(), "Show HN: A tiny HN reader");
    // non-numeric / over-long ids don't route to the item view
    await page.goto(`${server.base}/#/item/abc`);
    await page.waitForSelector(".story");
    // Algolia 404 + Firebase 404 are expected console noise ("Failed to load resource") only
    env.errors = env.errors.filter((e) => !/Failed to load resource.*404/.test(e));
    await a.assertClean();
  });

  test("search: submit renders Algolia hits (string objectID joined, nulls defaulted), sort toggle, load more", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    await page.fill("#q", "rust");
    await page.press("#q", "Enter");
    await page.waitForFunction(() => document.querySelectorAll("#view .story").length === 4);
    assert.match(page.url(), /#\/search\?q=rust$/);
    assert.equal(await page.locator('.tabs a[aria-current="page"]').count(), 0, "no feed tab is current on search");
    assert.equal(await page.locator("#live-pill").isHidden(), true);
    const titles = await a.titles();
    assert.equal(titles[0], `Why Rust & Go: it's "fast" <3`);
    assert.equal(titles[2], "Entities &lt;b&gt; stay literal", "decoded once, not twice");
    assert.equal(await page.locator(".story").nth(1).locator("a.title").getAttribute("href"), `#/item/${T(2)}`, "null url -> item view");
    assert.match(await page.locator(".story").nth(1).innerText(), /0 points.*0 comments/s, "null points/num_comments default to 0");
    assert.equal(await page.locator('.story a[href^="javascript"]').count(), 0, "javascript: hit url never an href");
    assert.equal(await page.locator("#q").inputValue(), "rust");
    assert.ok(env.alg.log.some((l) => l.startsWith("/api/v1/search?") && l.includes("query=rust") && l.includes("tags=story")));
    // sort by newest -> search_by_date
    await page.selectOption("#sort", "date");
    await page.waitForFunction(() => /NEWEST-FIRST/.test(document.body.innerText));
    assert.ok(env.alg.log.some((l) => l.startsWith("/api/v1/search_by_date?")));
    assert.match(page.url(), /sort=date/);
    // pagination
    await page.click("button:has-text('Load more')");
    await page.waitForFunction(() => document.querySelectorAll("#view .story").length === 5);
    // empty query
    await page.goto(`${server.base}/#/search?q=`);
    await page.waitForSelector(".empty");
    assert.match(await page.locator(".empty").textContent(), /Type a query/);
    await a.assertClean();
  });

  test("search: zero hits and Algolia failure show friendly messages (no crash)", async (t) => {
    const a = await open(t); if (!a) return;
    const { page } = a;
    env.alg.search = (q, e, p) => ({ hits: [], page: p, nbPages: 0 });
    await page.goto(`${server.base}/#/search?q=zzzz`);
    await page.waitForSelector(".empty");
    assert.equal(await page.locator(".empty").textContent(), `No stories found for "zzzz".`);
    // xss in the query string must be inert
    await page.goto(`${server.base}/#/search?q=${encodeURIComponent("<img src=x onerror=window.__pwn=1>")}`);
    await page.waitForSelector(".empty");
    assert.equal(await page.locator("#view img").count(), 0);
    assert.equal(await page.evaluate(() => window.__pwn), undefined);
    // upstream 429 -> error panel with Retry button
    await page.route(/hn\.algolia\.com\/api\/v1\/search\?/, (r) => r.fulfill({ status: 429, headers: CORS, body: "{}" }));
    await page.goto(`${server.base}/#/search?q=rate`);
    await page.waitForSelector("[role=alert] button");
    assert.match(await page.locator("[role=alert]").innerText(), /Something went wrong/);
    env.errors = env.errors.filter((e) => !/429|Failed to load resource|HTTP 429/.test(e));
    await a.assertClean();
  });

  test("sanitizer: every payload in tests/sanitize.payloads.json is neutralized in a real browser", async (t) => {
    const a = await open(t); if (!a) return;
    assert.ok(payloads.length >= 40, `expected a full payload list, got ${payloads.length}`);
    const res = await a.page.evaluate(async (list) => {
      const m = await import("/js/sanitize.js");
      let alerts = 0; window.alert = () => { alerts++; };
      const ALLOWED = new Set(["p", "i", "em", "b", "strong", "a", "pre", "code", "br"]);
      const failures = [], nonIdempotent = [];
      const host = document.createElement("div"); document.body.append(host);
      for (const p of list) {
        const out = m.sanitizeHtml(p.input);
        const low = out.toLowerCase();
        for (const s of p.mustNotContain) if (out.includes(s) || low.includes(s.toLowerCase())) failures.push(`${p.name}: output contains ${JSON.stringify(s)} -> ${out.slice(0, 120)}`);
        const box = document.createElement("div"); box.innerHTML = out; host.append(box);
        for (const el of box.querySelectorAll("*")) {
          const tag = el.tagName.toLowerCase();
          if (!ALLOWED.has(tag)) failures.push(`${p.name}: disallowed element <${tag}>`);
          for (const at of el.attributes) {
            if (tag !== "a" || !["href", "rel", "target"].includes(at.name)) failures.push(`${p.name}: disallowed attribute ${tag}[${at.name}]`);
          }
          if (tag === "a" && !/^https?:\/\//i.test(el.getAttribute("href") || "")) failures.push(`${p.name}: unsafe href ${el.getAttribute("href")}`);
          if (tag === "a" && !/noopener/.test(el.rel)) failures.push(`${p.name}: link without noopener`);
        }
        if (m.sanitizeHtml(out) !== out) nonIdempotent.push(p.name);   // mXSS guard: re-parse must be stable
      }
      await new Promise((r) => setTimeout(r, 100));   // let any injected handler/img fire
      const decoded = [m.decodeEntities("&lt;script&gt;"), m.decodeEntities("&amp;lt;"), m.decodeEntities("<img src=x onerror=alert(1)>"), m.decodeEntities("it&#x27;s")];
      const mutated = host.querySelectorAll("script,img,svg,iframe").length;
      return { failures, nonIdempotent, alerts, pwn: window.__pwn, decoded, mutated, n: list.length };
    }, payloads);
    assert.deepEqual(res.failures, []);
    assert.deepEqual(res.nonIdempotent, [], "sanitize(sanitize(x)) must equal sanitize(x)");
    assert.equal(res.alerts, 0); assert.equal(res.pwn, undefined); assert.equal(res.mutated, 0);
    assert.equal(res.decoded[0], "<script>", "decodeEntities('&lt;script&gt;')");
    assert.equal(res.decoded[1], "&lt;", "no double decode");
    assert.equal(res.decoded[2], "<img src=x onerror=alert(1)>", "tags in plain text stay literal text");
    assert.equal(res.decoded[3], "it's");
    assert.equal(res.n, payloads.length);
    await a.assertClean({ hostile: true });
  });

  test("sanitizer: safeHttpUrl accepts only http(s)", async (t) => {
    const a = await open(t); if (!a) return;
    const r = await a.page.evaluate(async () => {
      const { safeHttpUrl } = await import("/js/sanitize.js");
      return ["javascript:alert(1)", " javascript:alert(1)", "JaVaScRiPt:1", "java\tscript:1", "data:text/html,x", "//evil.example", "/rel", "https://ok.example/a b", "http://ok.example", "", null, 5, "https://" + "a".repeat(3000)].map(safeHttpUrl);
    });
    assert.deepEqual(r, [undefined, undefined, undefined, undefined, undefined, undefined, undefined, "https://ok.example/a%20b", "http://ok.example/", undefined, undefined, undefined, undefined]);
    await a.assertClean();
  });

  test("accessibility smoke: landmarks, names, focus target, skip link, no horizontal overflow at 390px", async (t) => {
    const a = await open(t, "#/top", { viewport: { width: 390, height: 844 } }); if (!a) return;
    const { page } = a;
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    for (const sel of ["header", "nav[aria-label=Feeds]", "main#main", "footer", "form[role=search]"]) assert.equal(await page.locator(sel).count(), 1, sel);
    const unnamed = await page.$$eval("button, a", (n) => n.filter((x) => !x.closest("[hidden]")).filter((x) => !(x.textContent.trim() || x.getAttribute("aria-label"))).map((x) => x.outerHTML.slice(0, 80)));
    assert.deepEqual(unnamed, [], "all links/buttons have an accessible name");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "no horizontal page overflow at 390px");
    await page.keyboard.press("Tab");
    assert.match(await page.evaluate(() => document.activeElement.className), /skip/);
    // tab targets >= 24px (WCAG 2.5.8)
    const small = await page.$$eval(".tabs a, .chip, .search button", (n) => n.map((x) => x.getBoundingClientRect()).filter((r) => r.height < 24 || r.width < 24).length);
    assert.equal(small, 0);
    await a.assertClean();
  });

  test("no request ever left the sandbox and the app only called expected local endpoints", async (t) => {
    const a = await open(t); if (!a) return;
    await a.page.waitForSelector(".story");
    assert.deepEqual(env.leaks, []);
    assert.ok(server.requests.some((r) => r === "GET /api/feed/top?page=0"));
    assert.ok(server.requests.every((r) => !/^GET \/(item|user)\//.test(r)));
  });
});

function state_addFresh(env, ...only) {
  const mk = (id, title, n) => ({ id, type: "story", by: "newbie", time: 1764001000 + n, title, url: `https://fresh${n}.example/a`, score: 3, descendants: 0 });
  const all = [mk(50709999, "Fresh story B", 2), mk(50709998, "Fresh story A", 1), mk(50709997, "Fresh story C", 3)];
  for (const it of all) env.hn.items[it.id] = it;
  const fresh = (only.length ? all.filter((x) => only.includes(x.id)) : all.slice(0, 2)).map((x) => x.id);
  env.hn.lists.topstories = [...fresh, ...env.hn.lists.topstories.filter((x) => !fresh.includes(x))];
}
