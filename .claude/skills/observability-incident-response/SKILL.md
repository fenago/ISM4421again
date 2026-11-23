---
name: observability-incident-response
description: Sets up observability and incident response for the HN tech-news app on Netlify, covering structured Function logs, Sentry error tracking, uptime and freshness checks, alert thresholds and runbooks. Use when asked to "add monitoring", "set up alerts", "the feed is stale", "Algolia is rate-limiting us", "write a runbook", "do a postmortem", or to define SLOs for feed freshness and latency.
metadata:
  id: S22
  used-by: [performance-realtime-engineer, security-engineer, devops-netlify-engineer, sre-monitoring-engineer]
  mvp: false
---
# Observability & Incident Response

## Purpose
Know before users do when feeds go stale, Functions fail, Algolia limits bite or a deploy breaks the site, and recover quickly with practiced runbooks.

## When to use
- Instrumenting new Functions/Scheduled Functions; setting alerts; on-call design.
- During an incident and the postmortem after it.

## SLOs (from docs/08 non-functional targets)
| SLI | SLO |
|---|---|
| Feed freshness: `now - feeds/top.json.generatedAt` | ≤ 5 min for 99% of minutes |
| Feed API latency p95 (cached) | < 200 ms |
| New top story visible in client | < 60 s after HN (live path via EventSource) |
| Function error rate (5xx) | < 1% per hour |
| Algolia usage | < 50% of 10k req/hr/IP budget |

## Instrumentation checklist
- [ ] Structured JSON logs in every Function: `{ level, fn, requestId, route, durationMs, upstream: "hn"|"algolia", status, cacheHit }`. No PII, no secrets, no full emails.
- [ ] Scheduled feed builder logs per run: lists fetched, items fetched, nulls/dead filtered, retries, duration, `generatedAt`.
- [ ] Sentry (or equivalent) in browser + Functions; release = git SHA from Netlify `COMMIT_REF`; source maps uploaded in CI, not served publicly; `sendDefaultPii: false`, scrub query strings for email params.
- [ ] Health endpoint `/api/health` returns `{ feedAgeSec, lastRunStatus, version }` (no secrets).
- [ ] External uptime check (e.g. every 1–5 min) on `/` and `/api/health` with freshness assertion.
- [ ] Client telemetry for EventSource: reconnect count, fallback-to-polling events (sampled, anonymous).
- [ ] Netlify deploy notifications → team channel; failed-deploy alert.

## Alert rules
| Alert | Condition | Severity |
|---|---|---|
| Stale feeds | feedAgeSec > 900 for 10 min | SEV2 |
| Site down | uptime fails 2 consecutive checks | SEV1 |
| Function errors | 5xx > 5% for 15 min | SEV2 |
| Algolia nearing limit | > 7,000 req/hr or any 429 | SEV3 |
| HN upstream errors | > 20% item fetch failures in a run | SEV3 (HN-side, usually transient) |
| Error spike after deploy | new Sentry issue > 50 events in 10 min | SEV2 → consider rollback |

## Runbooks
**Stale feeds:** check Scheduled Function logs → if upstream HN failing, keep serving last good blob (it's fine to be stale-but-up) and show "Updated N min ago"; if our code failing after a deploy, roll back via Netlify "Publish deploy" on the previous deploy; if Blobs write errors, check Netlify status page.
**Algolia 429/blocked:** raise cache TTLs (search-cache to 15 min), disable search-as-you-type (submit-only), show friendly "Search busy" message; investigate traffic source (bots → add rate limit at edge).
**Site down after deploy:** instant rollback in Netlify UI → open incident issue → fix forward on a branch with deploy preview.
**XSS/security report:** follow security-engineer process; disable affected render path, rotate secrets if exposed, purge CDN cache.

## Incident procedure
1. Declare: open GitHub issue `incident:<date>-<slug>`, assign incident lead, set SEV.
2. Stabilize first (rollback, kill switch env vars like `AI_SUMMARIES_ENABLED=false`), then diagnose.
3. Update status every 30 min (SEV1/2) in the issue.
4. Close with blameless postmortem within 3 days.

## Postmortem template
```markdown
## Incident <id> — <title>  SEV<n>  Duration: <start>–<end> UTC
Impact: who/what, numbers.  Detection: alert/user report, time to detect.
Timeline (UTC): ...
Root cause: ...  Contributing factors: ...
What went well / poorly: ...
Action items: [ ] owner, due date, issue link
```

## Pitfalls
- Alerting on HN's own blips with no grace period → alert fatigue.
- Logging full request URLs with emails/tokens.
- Monitoring only `/` (static CDN stays up while feeds are hours stale).
- No rollback rehearsal before launch day.

## Used by
- performance-realtime-engineer
- security-engineer
- devops-netlify-engineer
- sre-monitoring-engineer
