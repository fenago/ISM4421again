---
name: html-sanitization-web-security
description: Secures rendering of untrusted Hacker News content - DOMPurify allow-list for comment/story HTML, entity decoding for plain-text titles, URL scheme validation, safe external links, CSP and security headers on Netlify, input validation in Functions, and dependency/secret hygiene. Use when rendering item text/title/about, writing SafeHtml, adding headers or CSP, reviewing a PR for XSS, validating API params, or running npm audit.
metadata:
  id: S09
  used-by: [hn-api-integration-engineer, frontend-engineer, security-engineer, qa-test-engineer]
  mvp: true
---
# HTML Sanitization & Web Security

## Purpose
Every HN `text`, `title` and `about` field is user-generated HTML. The app must never execute it. Rule from [09](../../../docs/09-agent-team-briefing.md#conventions-shared-contract): **sanitize at ingest and again at render** (defense in depth). HTML quirks: [07](../../../docs/07-gotchas-and-edge-cases.md#html-content).

## When to use
Any code that displays HN or Algolia content, sets headers, accepts query params, or adds dependencies.

## What HN HTML looks like
- `<p>` as paragraph **separators** (often unclosed), `<i>`, `<a href="..." rel="nofollow">`, `<pre><code>`.
- Entities: `&#x27;` `&quot;` `&gt;` `&amp;` `&#x2F;`.
- Link text may be truncated with `...` while `href` holds the full URL.
- Algolia `_highlightResult` adds `<em>` tags - also untrusted.

## Sanitizer (shared, `src/lib/html/sanitize.ts`)
```ts
import DOMPurify from "isomorphic-dompurify";   // works in Functions (jsdom) and browser

const CONFIG = {
  ALLOWED_TAGS: ["p", "i", "em", "b", "strong", "a", "pre", "code", "br"],
  ALLOWED_ATTR: ["href"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,      // drops javascript:, data:, vbscript:
  KEEP_CONTENT: true,
};

DOMPurify.addHook("afterSanitizeAttributes", node => {
  if (node.tagName === "A") {
    node.setAttribute("rel", "nofollow noopener noreferrer ugc");
    node.setAttribute("target", "_blank");
  }
});

export function sanitizeHnHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIG) as string;
}
```
Render component:
```tsx
export function SafeHtml({ html }: { html?: string }) {
  if (!html) return null;
  return <div className="hn-text" dangerouslySetInnerHTML={{ __html: sanitizeHnHtml(html) }} />;
}
```
This is the **only** allowed use of `dangerouslySetInnerHTML` / `{@html}` / `innerHTML`. Add an ESLint rule (`react/no-danger` with an override for this file) to enforce it.

## Plain-text contexts: decode, don't render
Titles, `<title>`, notifications, search index, Open Graph tags, aria-labels: decode entities and render as **text**.
```ts
import { decode } from "he";                     // server + browser, no DOM needed
export const decodeEntities = (s: string) => decode(s);
// UI: <a href={story.url}>{story.title}</a>   -- React escapes it again, safely
```
Never decode then inject as HTML (that turns `&lt;script&gt;` into a live tag).

## URL validation
```ts
export function safeHttpUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try { const u = new URL(raw); return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined; }
  catch { return undefined; }
}
```
Apply to `story.url` in the normalizer. Story links: `target="_blank" rel="noopener noreferrer"`.

## Netlify security headers
Set in `netlify.toml` (`[[headers]] for = "/*"`, see `netlify-platform`):
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; connect-src 'self' https://hacker-news.firebaseio.com https://*.firebaseio.com;
  frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
- `*.firebaseio.com` is needed because Firebase can 307-redirect the SSE stream.
- Algolia is proxied, so `hn.algolia.com` is **not** in `connect-src`.
- Next.js inline scripts may need nonces/hashes - test CSP on the deploy preview; start with `Content-Security-Policy-Report-Only` if unsure.

## Function input validation
- Feed name from an allow-list; `page` integer clamped 0..16; item `id` matches `/^\d{1,9}$/`.
- Search `q` trimmed, max 100 chars; `tags` from allow-list. Build upstream URLs with `URLSearchParams`, never string concat.
- Return generic error messages; log details server-side. No CORS `*` on endpoints unless needed (same-origin by default).

## Dependencies & secrets
- `npm audit --audit-level=high` in CI; Dependabot weekly; pin via `package-lock.json`, install with `npm ci`.
- Review new deps: maintenance, size, install scripts.
- HN/Algolia need no secrets. Any future key (LLM, email) lives in Netlify env vars scoped to Functions, never in client bundles or the repo.

## XSS test payloads (fixture `tests/fixtures/hn/xss-comment.json`)
```
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<a href="javascript:alert(1)">x</a>
<a href="JaVaScRiPt:alert(1)">x</a>
<svg><animate onbegin=alert(1)>
<p style="background:url(javascript:alert(1))">x
&lt;script&gt;alert(1)&lt;/script&gt;   (title: must render as literal text)
```
Assert output contains no `<script`, `on*=` attributes, or `javascript:`; links get `rel="nofollow noopener noreferrer ugc"`.

## Review checklist
- [ ] No raw HN HTML reaches the DOM outside `SafeHtml`.
- [ ] Titles rendered as text, decoded once.
- [ ] Story URLs validated to http(s).
- [ ] CSP + headers present on deploy preview (check response headers).
- [ ] Function params validated; upstream URLs built with `URLSearchParams`.
- [ ] `npm audit` clean at high; no secrets in repo or client bundle.

## Used by
hn-api-integration-engineer, frontend-engineer, security-engineer, qa-test-engineer
