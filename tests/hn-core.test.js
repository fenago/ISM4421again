// Unit + integration tests for public/js/hn-core.js and netlify/functions/feed.js.
// All HTTP is stubbed from tests/fixtures/hn (no live HN). Run: npm test
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  normalize, classify, decodeEntities, domainOf, mapLimit, getJSON, fetchFeed, isFeed, FEEDS, HN_BASE,
} from "../public/js/hn-core.js";
import handler, { config } from "../netlify/functions/feed.js";
import { makeHnState, makeFetchStub, readFix } from "./helpers/fixtures.js";

const realFetch = globalThis.fetch;
let state;
const id = (n) => 50700000 + n;
const fx = (n) => readFix(`item-${id(n)}.json`);

beforeEach(() => { state = makeHnState(); globalThis.fetch = makeFetchStub(state); });
afterEach(() => { globalThis.fetch = realFetch; });

describe("decodeEntities (docs/07 HTML in title)", () => {
  test("decodes numeric hex, named and quote entities", () => {
    assert.equal(decodeEntities("it&#x27;s &quot;x&quot; &gt; &#60;"), `it's "x" > <`);
  });
  test("single pass: no double decoding", () => {
    assert.equal(decodeEntities("&amp;lt;script&amp;gt;"), "&lt;script&gt;");
    assert.equal(decodeEntities("&amp;amp;"), "&amp;");
  });
  test("decodes escaped tags to literal text, leaves unknown entities and bad code points", () => {
    assert.equal(decodeEntities("&lt;script&gt;"), "<script>");
    assert.equal(decodeEntities("&bogus; &#xFFFFFFFF; &#0;"), "&bogus; &#xFFFFFFFF; &#0;");
  });
});

describe("normalize / classify over every fixture edge case", () => {
  test("entities in title are decoded exactly once; www. stripped from domain; unknown fields ignored", () => {
    const s = normalize(fx(1), 1);
    assert.equal(s.title, `Why Rust & Go: it's "fast" <3`);
    assert.equal(s.domain, "example.com");
    assert.equal(s.kind, "link");
    assert.equal(s.hnUrl, "https://news.ycombinator.com/item?id=50700001");
    assert.equal(s.author, "pg");
    assert.equal(s.time, 1764000000, "time stays in unix SECONDS");
    assert.equal(s.points, 512);
    assert.equal(s.comments, 301);
  });
  test("Ask HN without url", () => {
    const s = normalize(fx(2), 2);
    assert.equal(s.kind, "ask"); assert.equal(s.url, undefined); assert.equal(s.hasText, true);
  });
  test("Show HN / Launch HN / Tell HN classified by title prefix", () => {
    assert.equal(normalize(fx(3), 3).kind, "show");
    assert.equal(normalize(fx(11), 11).kind, "launch");
    assert.equal(normalize(fx(10), 10).kind, "tell");
  });
  test("prefix match is case-insensitive and anchored at start", () => {
    assert.equal(classify({ title: "show hn: x", url: "https://a.b" }), "show");
    assert.equal(classify({ title: "I saw Show HN: x", url: "https://a.b" }), "link");
  });
  test("job with url '' => kind job, url undefined, no domain, 0 comments", () => {
    const s = normalize(fx(4), 4);
    assert.equal(s.kind, "job"); assert.equal(s.url, undefined); assert.equal(s.domain, undefined);
    assert.equal(s.comments, 0);
  });
  test("poll keeps kind poll", () => assert.equal(normalize(fx(5), 5).kind, "poll"));
  test("dead, deleted, null, untitled, and comment-in-feed are dropped", () => {
    assert.equal(normalize(fx(6), 6), null, "dead");
    assert.equal(normalize(fx(7), 7), null, "deleted");
    assert.equal(normalize(fx(8), 8), null, "literal null");
    assert.equal(normalize(fx(9), 9), null, "no title");
    assert.equal(normalize(fx(14), 14), null, "type comment");
    assert.equal(normalize(undefined, 1), null);
    assert.equal(normalize("str", 1), null);
    assert.equal(normalize({ id: 1, title: "   " }, 1), null, "blank title");
    assert.equal(normalize({ title: "no id" }, 1), null, "no id");
  });
  test("url + text both present are both retained", () => {
    const s = normalize(fx(12), 12);
    assert.equal(s.url, "https://blog.example.org/post?a=1&b=2"); assert.equal(s.hasText, true);
    assert.equal(s.kind, "link");
  });
  test("javascript: url is rejected (and the story is NOT mislabelled as Ask)", () => {
    const s = normalize(fx(13), 13);
    assert.equal(s.url, undefined);
    assert.equal(s.domain, undefined);
    assert.equal(s.kind, "link", "a story that HAD a url must not become kind=ask");
  });
  test("non-http(s) schemes and garbage urls are rejected", () => {
    for (const u of ["data:text/html,x", "ftp://x.y/z", "vbscript:x", "not a url", "  ", "//x.y"]) {
      assert.equal(normalize({ id: 1, title: "t", url: u }, 1).url, undefined, u);
    }
    assert.equal(normalize({ id: 1, title: "t", url: "  https://ok.example/a  " }, 1).url, "https://ok.example/a");
  });
  test("missing score/descendants/by/time default safely; username case preserved", () => {
    const s = normalize({ id: 1, title: "t", url: "https://x.y" }, 1);
    assert.deepEqual([s.points, s.comments, s.author, s.time], [0, 0, undefined, 0]);
    assert.equal(normalize({ id: 1, title: "t", by: "MiXeD_Case" }, 1).author, "MiXeD_Case");
  });
  test("non-numeric score/descendants (hostile data) default to 0", () => {
    const s = normalize({ id: 1, title: "t", score: "9", descendants: NaN, time: null }, 1);
    assert.deepEqual([s.points, s.comments, s.time], [0, 0, 0]);
  });
  test("domainOf tolerates junk", () => {
    assert.equal(domainOf(undefined), undefined);
    assert.equal(domainOf("::"), undefined);
    assert.equal(domainOf("https://www.a.com/x"), "a.com");
  });
});

describe("getJSON", () => {
  test("literal null body (HTTP 200) is returned as null, not an error", async () => {
    assert.equal(await getJSON(`${HN_BASE}/item/${id(8)}.json`), null);
  });
  test("retries 503 then succeeds", async () => {
    let n = 0;
    globalThis.fetch = makeFetchStub(state, { onHn: () => (++n < 3 ? new Response("x", { status: 503 }) : undefined) });
    const body = await getJSON(`${HN_BASE}/item/${id(1)}.json`);
    assert.equal(body.id, id(1)); assert.equal(n, 3);
  });
  test("gives up after retries (3 attempts total) on persistent 503", async () => {
    let n = 0;
    globalThis.fetch = makeFetchStub(state, { onHn: () => { n++; return new Response("x", { status: 503 }); } });
    await assert.rejects(getJSON(`${HN_BASE}/topstories.json`), /503/);
    assert.equal(n, 3);
  });
  test("retries 429 and network errors", async () => {
    let n = 0;
    globalThis.fetch = makeFetchStub(state, { onHn: () => { n++; if (n === 1) return new Response("x", { status: 429 }); if (n === 2) throw new TypeError("network"); } });
    assert.equal((await getJSON(`${HN_BASE}/item/${id(1)}.json`)).id, id(1)); assert.equal(n, 3);
  });
  test("does NOT retry 404", async () => {
    let n = 0;
    globalThis.fetch = makeFetchStub(state, { onHn: () => { n++; return new Response("nope", { status: 404 }); } });
    await assert.rejects(getJSON(`${HN_BASE}/item/1.json`), /404/);
    assert.equal(n, 1);
  });
  test("expired deadline throws without calling fetch", async () => {
    let n = 0;
    globalThis.fetch = async () => { n++; return new Response("1"); };
    await assert.rejects(getJSON("https://hacker-news.firebaseio.com/v0/x.json", { deadline: Date.now() - 1 }), /deadline/);
    assert.equal(n, 0);
  });
  test("timeout aborts a hung request and rejects", async () => {
    globalThis.fetch = (u, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    await assert.rejects(getJSON("https://hacker-news.firebaseio.com/v0/x.json", { timeout: 30, retries: 0 }));
  });
});

describe("mapLimit", () => {
  test("preserves input order and never exceeds the concurrency limit", async () => {
    let inflight = 0, max = 0;
    const xs = Array.from({ length: 25 }, (_, i) => i);
    const out = await mapLimit(xs, 4, async (x) => {
      inflight++; max = Math.max(max, inflight);
      await new Promise(r => setTimeout(r, 15 - (x % 5) * 3)); // finish out of order
      inflight--; return x * 2;
    });
    assert.deepEqual(out, xs.map(x => x * 2));
    assert.ok(max <= 4 && max >= 2, `max inflight was ${max}`);
  });
  test("a rejecting task yields null for that slot only; empty input OK; limit<1 coerced", async () => {
    assert.deepEqual(await mapLimit([1, 2, 3], 2, async (x) => { if (x === 2) throw new Error("x"); return x; }), [1, null, 3]);
    assert.deepEqual(await mapLimit([], 5, async () => 1), []);
    assert.deepEqual(await mapLimit([1], 0, async (x) => x), [1]);
  });
});

describe("fetchFeed", () => {
  test("page 0: 30 ids requested, order + original rank preserved, bad items dropped", async () => {
    const p = await fetchFeed("top", 0);
    assert.equal(p.feed, "top"); assert.equal(p.page, 0); assert.equal(p.total, 35); assert.equal(p.hasMore, true);
    // dropped: 6 dead, 7 deleted, 8 null, 9 untitled, 14 comment
    assert.equal(p.stories.length, 25);
    assert.equal(p.skipped, 5);
    assert.ok(!p.partial);
    const ranks = p.stories.map(s => s.rank);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "ascending");
    assert.deepEqual(p.stories.map(s => s.id), p.stories.map(s => 50700000 + s.rank), "rank == original index+1, not shifted by filtering");
    assert.equal(new Set(p.stories.map(s => s.id)).size, 25);
    assert.ok(!isNaN(Date.parse(p.fetchedAt)));
    const itemCalls = state.log.filter(u => u.includes("/item/"));
    assert.equal(itemCalls.length, 30, "only page-sized slice fetched, not all 500");
    assert.ok(state.log.every(u => u.endsWith(".json")), "every URL ends in .json");
  });
  test("page 1: remaining 5 ids, ranks 31..35, hasMore false", async () => {
    const p = await fetchFeed("top", 1);
    assert.deepEqual(p.stories.map(s => s.rank), [31, 32, 33, 34, 35]);
    assert.equal(p.hasMore, false);
    const p0 = await fetchFeed("top", 0);
    const overlap = p.stories.filter(s => p0.stories.some(t => t.id === s.id));
    assert.deepEqual(overlap, [], "no story appears on both pages");
  });
  test("out-of-range page: empty, hasMore false, no item fetches", async () => {
    state.log.length = 0;
    const p = await fetchFeed("top", 9);
    assert.deepEqual(p.stories, []); assert.equal(p.hasMore, false); assert.equal(p.skipped, 0);
    assert.equal(state.log.filter(u => u.includes("/item/")).length, 0);
  });
  test("exactly-30-ids list: hasMore false (boundary)", async () => {
    state.lists.topstories = state.lists.topstories.slice(0, 30);
    assert.equal((await fetchFeed("top", 0)).hasMore, false);
  });
  test("every feed name maps to the right .json list; jobs labelled job", async () => {
    for (const f of Object.keys(FEEDS)) { assert.ok(isFeed(f)); await fetchFeed(f, 0); }
    const j = await fetchFeed("job", 0);
    assert.deepEqual(j.stories.map(s => s.kind), ["job"]);
    assert.ok(state.log.some(u => u.endsWith("/jobstories.json")));
  });
  test("job inside /topstories is returned and labelled (not filtered)", async () => {
    const p = await fetchFeed("top", 0);
    assert.equal(p.stories.find(s => s.id === id(4)).kind, "job");
  });
  test("list capped upstream (500) and non-integer ids ignored", async () => {
    state.lists.topstories = [...state.lists.topstories, null, "x", 1.5];
    assert.equal((await fetchFeed("top", 0)).total, 35);
  });
  test("list endpoint returning null/object => empty page, no crash", async () => {
    state.lists.topstories = null;
    state.lists.newstories = { a: 1 };
    // null list is served as 200 + null
    const a = await fetchFeed("top", 0);
    assert.deepEqual([a.stories.length, a.total, a.hasMore], [0, 0, false]);
    assert.equal((await fetchFeed("new", 0)).total, 0);
  });
  test("one item 503s once: retried, page complete, not partial", async () => {
    let hit = 0;
    globalThis.fetch = makeFetchStub(state, { onHn: (u) => (u.endsWith(`/item/${id(15)}.json`) && ++hit === 1 ? new Response("x", { status: 503 }) : undefined) });
    const p = await fetchFeed("top", 0);
    assert.equal(hit, 2); assert.ok(!p.partial); assert.ok(p.stories.some(s => s.id === id(15)));
  });
  test("one item persistently fails: partial=true, others still returned in order", async () => {
    globalThis.fetch = makeFetchStub(state, { onHn: (u) => (u.endsWith(`/item/${id(15)}.json`) ? new Response("x", { status: 500 }) : undefined) });
    const p = await fetchFeed("top", 0);
    assert.equal(p.partial, true); assert.equal(p.stories.length, 24); assert.ok(!p.stories.some(s => s.id === id(15)));
  });
  test("all items failing throws; list failing throws", async () => {
    globalThis.fetch = makeFetchStub(state, { onHn: (u) => (u.includes("/item/") ? new Response("x", { status: 404 }) : undefined) });
    await assert.rejects(fetchFeed("top", 0), /all item fetches failed/);
    globalThis.fetch = makeFetchStub(state, { onHn: (u) => (u.includes("topstories") ? new Response("x", { status: 404 }) : undefined) });
    await assert.rejects(fetchFeed("top", 0), /404/);
  });
  test("item fetch concurrency is bounded by opts.concurrency", async () => {
    let inflight = 0, max = 0;
    globalThis.fetch = makeFetchStub(state, {
      onHn: async (u) => {
        if (!u.includes("/item/")) return;
        inflight++; max = Math.max(max, inflight);
        await new Promise(r => setTimeout(r, 10)); inflight--;
      },
    });
    await fetchFeed("top", 0, { concurrency: 5 });
    assert.ok(max <= 5 && max > 1, `max inflight ${max}`);
  });
  test("rejects unknown feed and invalid page", async () => {
    await assert.rejects(fetchFeed("nope"), /Unknown feed/);
    await assert.rejects(fetchFeed("constructor"), /Unknown feed/);
    await assert.rejects(fetchFeed("top", -1), /Invalid page/);
    await assert.rejects(fetchFeed("top", 1.5), /Invalid page/);
  });
  test("deadline: overall budget is enforced", async () => {
    // hangs until aborted, like a real fetch honouring its AbortSignal
    globalThis.fetch = (u, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    const t0 = Date.now();
    await assert.rejects(fetchFeed("top", 0, { deadlineMs: 150 }));
    assert.ok(Date.now() - t0 < 2000, "did not hang");
  });
});

describe("Function: /api/feed/:name", () => {
  const call = (name, qs = "", init = {}) =>
    handler(new Request(`http://localhost/api/feed/${name}${qs}`, init), { params: { name } });

  test("route config", () => assert.equal(config.path, "/api/feed/:name"));

  test("200 + CDN cache headers + JSON body", async () => {
    const res = await call("top");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /application\/json/);
    assert.match(res.headers.get("netlify-cdn-cache-control"), /s-maxage=60/);
    assert.match(res.headers.get("netlify-cdn-cache-control"), /stale-while-revalidate/);
    assert.equal(res.headers.get("cache-control"), "public, max-age=0, must-revalidate");
    const body = await res.json();
    assert.equal(body.stories.length, 25);
    assert.equal(body.stories[0].title, `Why Rust & Go: it's "fast" <3`);
  });
  test("page param honoured", async () => {
    const body = await (await call("top", "?page=1")).json();
    assert.equal(body.page, 1); assert.equal(body.stories.length, 5);
  });
  test("page defaults to 0; MAX_PAGE (16) accepted and returns empty page", async () => {
    assert.equal((await (await call("top")).json()).page, 0);
    const r = await call("top", "?page=16");
    assert.equal(r.status, 200); assert.deepEqual((await r.json()).stories, []);
  });
  test("feed name falls back to ?feed= then 'top' when no params", async () => {
    const r = await handler(new Request("http://localhost/api/feed/x?feed=new"), {});
    assert.equal((await r.json()).feed, "new");
    const r2 = await handler(new Request("http://localhost/api/feed/x"), undefined);
    assert.equal((await r2.json()).feed, "top");
  });
  test("400 for unknown feed, prototype names, and bad pages; never cached", async () => {
    const bad = [["nope", ""], ["constructor", ""], ["__proto__", ""], ["toString", ""], ["hasOwnProperty", ""], ["top", "?page=-1"], ["top", "?page=abc"],
      ["top", "?page=17"], ["top", "?page=1.5"], ["top", "?page="], ["top", "?page=%20"], ["top", "?page=0001"], ["top", "?page=1e1"]];
    for (const [name, qs] of bad) {
      const res = await call(name, qs);
      assert.equal(res.status, 400, `${name}${qs}`);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.equal(res.headers.get("netlify-cdn-cache-control"), null);
    }
    assert.ok(state.log.every(u => !u.includes("constructor") && !u.includes("proto")), "bad names never reach upstream");
  });
  test("405 for POST/PUT/DELETE with Allow header; HEAD allowed", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const r = await call("top", "", { method, body: "{}" });
      assert.equal(r.status, 405, method); assert.equal(r.headers.get("allow"), "GET, HEAD");
    }
    assert.equal((await call("top", "", { method: "HEAD" })).status, 200);
  });
  test("502 generic message when upstream list fails (no internals leaked)", async () => {
    globalThis.fetch = makeFetchStub(state, { onHn: () => new Response("boom secret-host", { status: 503 }) });
    const origErr = console.error; console.error = () => {};
    try {
      const r = await call("top");
      assert.equal(r.status, 502);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.equal(r.headers.get("netlify-cdn-cache-control"), null);
      const text = await r.text();
      assert.doesNotMatch(text, /secret-host|503|firebaseio/);
    } finally { console.error = origErr; }
  });
  test("partial page gets a SHORT CDN cache (self-heals)", async () => {
    globalThis.fetch = makeFetchStub(state, { onHn: (u) => (u.endsWith(`/item/${id(15)}.json`) ? new Response("x", { status: 500 }) : undefined) });
    const r = await call("top");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("netlify-cdn-cache-control"), /s-maxage=10\b/);
    assert.equal((await r.json()).partial, true);
  });
});
