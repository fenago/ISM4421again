// Shared test helpers: fixture-backed fake of the HN Firebase API. Never touches the network.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../..");
export const FIX = path.join(ROOT, "tests/fixtures/hn");
export const HN_BASE = "https://hacker-news.firebaseio.com/v0";

export const readFix = (name) => JSON.parse(readFileSync(path.join(FIX, name), "utf8"));

/**
 * Mutable fake HN state. Tests may override lists or add items.
 * lists: feed file name (e.g. "topstories") -> id array. items: id -> raw item (or null).
 */
export function makeHnState() {
  const top = readFix("topstories.json");
  return {
    lists: {
      topstories: top, newstories: readFix("newstories.json"), beststories: top.slice(0, 10),
      askstories: [50700002], showstories: [50700003], jobstories: [50700004],
    },
    items: {},          // overrides / additions
    log: [],            // every URL served
  };
}

/** @returns {{status:number, body:any}} for an HN URL, mimicking HN: unknown item => 200 + null. */
export function hnLookup(state, url) {
  state.log.push(url);
  const u = new URL(url);
  const m = u.pathname.match(/^\/v0\/(.+)\.json$/);
  if (!m) return { status: 404, body: null };            // missing ".json" suffix => not JSON
  const key = m[1];
  if (state.lists[key]) return { status: 200, body: state.lists[key] };
  const im = key.match(/^item\/(\d+)$/);
  if (im) {
    const id = Number(im[1]);
    if (id in state.items) return { status: 200, body: state.items[id] };
    const f = path.join(FIX, `item-${id}.json`);
    return { status: 200, body: existsSync(f) ? readFix(`item-${id}.json`) : null };
  }
  return { status: 404, body: null };
}

/** fetch stub: HN URLs from fixtures; anything else throws (no accidental live calls). */
export function makeFetchStub(state, { onHn } = {}) {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.url ?? String(input);
    if (!url.startsWith(HN_BASE)) throw new Error(`UNMOCKED fetch to ${url}`);
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const hook = onHn ? await onHn(url, state) : undefined;
    if (hook) return hook;
    const { status, body } = hnLookup(state, url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
}
