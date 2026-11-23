---
name: community-management
description: Runs community operations for the HN tech-news app, including the Show HN launch day playbook, reply templates, feedback intake and triage into GitHub issues, feature-request loop, moderation and code of conduct for project channels. Use when asked to "run the launch", "reply to this HN comment", "triage feedback", "set up a feedback channel", "handle a feature request/complaint", or to write a launch-day runbook.
metadata:
  id: S31
  used-by: [hn-community-expert, product-marketing-strategist, community-manager]
  mvp: false
---
# Community Management

## Purpose
Turn launch attention and ongoing user feedback into goodwill and a better product, through fast, honest responses and a visible loop from feedback to shipped changes.

## When to use
- Show HN launch day and the week after.
- Setting up and operating feedback channels (GitHub Issues/Discussions, email).
- Responding to criticism, bug reports, takedown or privacy requests (route the latter to legal/privacy).

## Channels
| Channel | Purpose | Owner |
|---|---|---|
| HN thread (Show HN) | Launch conversation | maker + community-manager |
| GitHub Issues (templates: bug, feature, topic request) | Actionable work | community-manager triages |
| GitHub Discussions | Ideas, Q&A | community-manager |
| privacy/legal email | DSRs, takedowns | privacy-compliance-officer / legal-counsel (never public) |
| In-app "Feedback" link | Low-friction input → form/issue template | community-manager |

## Launch day playbook (Show HN, see hn-community-norms)
- **T−1 day:** monitoring + rollback rehearsed (observability-incident-response); caches warmed; FAQ answers drafted; team agrees on who replies (one maker account, disclosed).
- **T0 post:** submit; post maker's first comment (story, tech, what feedback you want). Don't share upvote links.
- **T0–T+6 h:** check thread every 10–15 min; reply to every substantive question; log every bug/request to issues with label `launch-feedback`; hotfix only low-risk issues via PR + deploy preview.
- **T+24 h:** thank-you comment summarizing what changed due to feedback (only if natural, not spammy).
- **T+7 d:** feedback synthesis to product-owner; close the loop publicly (changelog).

## Reply templates (adapt, never paste verbatim repeatedly)
- **Bug:** "Thanks, reproduced it: <cause>. Fix is in <PR/issue link>, should be live within <time>."
- **Feature request:** "Good idea. Tracking it in <issue>. Curious: would you use it for <specific use>?"
- **Criticism (valid):** "Fair point. <Acknowledge specifically>. We chose <X> because <reason>, but <what we'll try>."
- **"Why not just use HN?":** "You should keep using HN! This is a companion for <use case>; everything links back to the HN thread."
- **Privacy question:** factual answer matching the privacy policy; link it.
- **Affiliation question:** "No, it's unofficial and not affiliated with HN or Y Combinator; it uses the public HN API."

## Feedback triage procedure (weekly, or daily during launch)
1. Collect from all channels into GitHub issues (strip personal data from emails before filing).
2. Label: `bug`/`feature`/`topic-request`/`docs`/`question`; severity for bugs; `launch-feedback` if applicable.
3. Deduplicate; add +1 count in a comment instead of new issues.
4. Score features: reach (how many asked) × impact × confidence ÷ effort; hand top items to product-owner.
5. Respond on the original channel with the issue link or a clear "won't do, because…".
6. Monthly changelog crediting reporters (with permission).

## Moderation
- Adopt Contributor Covenant for repo spaces; enforce consistently; private warnings first.
- Never moderate or argue on HN beyond our own replies; flagging is HN's process, not ours.
- Remove personal data posted publicly in issues; redirect to private channels.

## Pitfalls
- Defensive replies or multiple team accounts piling on.
- Asking for upvotes or stars in the HN thread.
- Feedback that disappears (no loop back).
- Handling takedown/DSR requests in public issues.

## Used by
- hn-community-expert
- product-marketing-strategist
- community-manager
