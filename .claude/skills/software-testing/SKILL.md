---
name: software-testing
description: Defines the test strategy for the HN app - Vitest unit tests on recorded HN/Algolia fixtures, MSW-mocked client and Netlify Function tests, contract tests and an opt-in live smoke suite, SSE event-sequence tests, and Playwright E2E with a fake EventSource - plus the docs/07 edge-case test matrix that gates merges. Use when writing or reviewing tests, recording fixtures, mocking HN/Algolia/EventSource, setting coverage gates, or checking that every edge case is covered.
metadata:
  id: S10
  used-by: [hn-api-integration-engineer, frontend-engineer, performance-realtime-engineer, security-engineer, qa-test-engineer]
  mvp: true
---
# Software Testing

## Purpose
Prove the app handles HN's messy data and flaky networks without depending on live HN. Rules from [09](../../../docs/09-agent-team-briefing.md): tests must not hit live HN by default; every edge case in [07](../../../docs/07-gotchas-and-edge-cases.md) has a test. (Our sandbox gets 403 for `hacker-news.firebaseio.com` anyway.)

## When to use
Adding any feature or fix, recording fixtures, setting up CI test steps, triaging a flaky test.

## Test pyramid
| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest | normalize, classify, sanitize, decode, `applyEvent`, `mapLimit`, param validators | every PR |
| Integration | Vitest + MSW | `client.ts` retries/timeouts/null; Functions (`feeds`, `search`, `refresh-feeds`) with mocked fetch + in-memory Blobs | every PR |
| Component | Vitest + Testing Library | StoryRow, SafeHtml, CommentNode, NewStoriesPill | every PR |
| E2E | Playwright | feeds, pagination, story view, search, live pill, fallback | every PR (mocked network) |
| Contract / live smoke | Vitest, `HN_LIVE=1` | real HN + Algolia shapes still match types | scheduled, never blocks PRs |

## Fixtures
```
tests/fixtures/hn/
  topstories.json            # ~500 ids (example first id 50611576)
  item-8863-story.json       # classic link story from docs/02
  item-ask.json item-show.json item-job-empty-url.json item-poll.json
  item-deleted.json          # { "id": 1, "deleted": true, "type": "comment", "time": ... }
  item-dead.json item-no-kids.json item-link-with-text.json
  item-null.json             # literally: null
  xss-comment.json           # payloads from html-sanitization-web-security
  updates.json
  sse/topstories-put.txt sse/topstories-patch.txt sse/keepalive.txt
tests/fixtures/algolia/
  search-rust.json search_by_date-llm.json items-8863-tree.json hit-null-points.json
```
Record fixtures from a network with access (or via the external fetch used for research), strip nothing but volatile headers, and note the capture date in a `README` in the folder.

## MSW setup
```ts
// tests/msw.ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import top from "./fixtures/hn/topstories.json";
const HN = "https://hacker-news.firebaseio.com/v0";
export const server = setupServer(
  http.get(`${HN}/topstories.json`, () => HttpResponse.json(top)),
  http.get(`${HN}/item/:id.json`, async ({ params }) => {
    try { return HttpResponse.json((await import(`./fixtures/hn/item-${params.id}.json`)).default); }
    catch { return HttpResponse.json(null); }                  // HN returns 200 + null
  }),
);
// vitest.setup.ts: beforeAll(() => server.listen({ onUnhandledRequest: "error" })); afterEach(() => server.resetHandlers()); afterAll(() => server.close());
```
`onUnhandledRequest: "error"` guarantees no accidental live calls.

Example tests:
```ts
it("returns 30 stories in rank order, backfilling dead ones", async () => {
  server.use(http.get(`${HN}/item/50614249.json`, () => HttpResponse.json({ id: 50614249, dead: true })));
  const page = await getFeedPage("top", 0);
  expect(page).toHaveLength(30);
  expect(page.map(s => s.rank)).toEqual([...page.map(s => s.rank)].sort((a, b) => a! - b!));
  expect(page.find(s => s.id === 50614249)).toBeUndefined();
});

it("retries 503 then succeeds; does not retry 404", async () => {
  let n = 0;
  server.use(http.get(`${HN}/item/1.json`, () => (++n < 2 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ id: 1 }))));
  await expect(getItem(1)).resolves.toMatchObject({ id: 1 });
  expect(n).toBe(2);
});
```
Use `vi.useFakeTimers()` for backoff/timeout tests. For Functions, call the default export with `new Request("http://localhost/api/feeds/top")` and a stub `Context`; mock `@netlify/blobs` with an in-memory `Map`.

## Edge-case matrix (from docs/07) - each row needs >= 1 test
| Case | Expectation |
|---|---|
| item `null` | skipped, no crash |
| missing score/descendants/kids/by | defaults 0 / [] / "unknown" |
| deleted / dead in feed | filtered + backfilled to 30 |
| deleted / dead in comment tree with kids | placeholder, children rendered |
| job in topstories | labeled "Job" (or filtered per ADR) |
| `url: ""` | no external link, HN link only |
| url + text both present | both shown |
| Ask/Show/Launch/Tell prefixes | correct `kind` |
| time in seconds | correct relative age |
| HTML entities in title | decoded text, not HTML |
| XSS payloads | neutralized |
| unknown extra fields | ignored |
| case-sensitive username | not lowercased |
| SSE put / patch / `/3` path / keep-alive / cancel | correct list state, reconnect |
| stream errors x5 | polling fallback |
| Algolia string objectID, null points | number id, 0 points |
| Algolia 429 | stale cache or 503 + Retry-After |
| Blobs empty | 503 "warming up" |

## Playwright
```ts
// e2e/live.spec.ts
test("shows new-stories pill without reordering", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeES extends EventTarget {
      constructor(public url: string) { super(); (window as any).__es = this;
        setTimeout(() => this.dispatchEvent(Object.assign(new Event("put"), { data: JSON.stringify({ path: "/", data: (window as any).__ids }) })), 0); }
      close() {} onerror = null;
    }
    (window as any).EventSource = FakeES;
  });
  await page.route("**/api/feeds/top*", r => r.fulfill({ path: "tests/fixtures/api/feed-top.json" }));
  await page.goto("/top");
  const first = await page.getByRole("listitem").first().textContent();
  await page.evaluate(() => (window as any).__es.dispatchEvent(Object.assign(new Event("patch"),
    { data: JSON.stringify({ path: "/", data: { "0": 99999999 } }) })));
  await expect(page.getByRole("button", { name: /1 new stor/i })).toBeVisible();
  expect(await page.getByRole("listitem").first().textContent()).toBe(first);
});
```
Also: feed tabs, page 2 stability, story view with lazy comments, search (mock `/api/search`), keyboard navigation, and an `@axe-core/playwright` scan per page.

## Gates
- CI: `vitest --coverage` with thresholds (lines >= 80% on `src/lib/**`), all E2E green.
- A bug fix PR includes a failing-then-passing regression test.
- Live smoke failure opens an issue (contract drift), does not block merges.

## Pitfalls
- Snapshotting entire HN payloads (brittle) instead of asserting behavior.
- Real timers in retry tests (slow, flaky).
- Tests that rely on today's top stories.
- Forgetting the `null` fixture is literally `null`, not `{}`.

## Used by
hn-api-integration-engineer, frontend-engineer, performance-realtime-engineer, security-engineer, qa-test-engineer
