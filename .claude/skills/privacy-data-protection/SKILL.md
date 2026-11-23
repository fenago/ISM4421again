---
name: privacy-data-protection
description: Applies privacy and data-protection practice (GDPR, UK GDPR, CCPA/CPRA) to the HN tech-news app, covering data inventory, lawful basis and consent for analytics, optional accounts and email digests, privacy policy drafting, retention schedules and data-subject requests on a Netlify stack. Use when asked "do we need a cookie banner", "draft the privacy policy", "can we add email digests/accounts", "what analytics are allowed", "how long do we keep data", or to review a feature that touches personal data.
metadata:
  id: S27
  used-by: [data-engineer, legal-counsel, privacy-compliance-officer, growth-analytics-marketer]
  mvp: false
---
# Privacy & Data Protection

> **Not legal advice.** Use this to plan and draft. Have a licensed attorney (and, if applicable, a qualified privacy professional) review the privacy policy, consent design and processor agreements before collecting personal data from the public.

## Purpose
Keep personal-data collection minimal by default (the MVP can need none) and handle accounts, email digests and analytics lawfully and transparently when they're added.

## When to use
- Any feature that stores or transmits data about a person: accounts, saved topics synced server-side, email digests, analytics, error tracking, feedback forms, AI providers.
- Before public launch; when adding a vendor (processor).

## Privacy-by-default stance for this app
- **MVP:** no accounts; topic prefs/theme in `localStorage`; no third-party trackers; server logs without IPs where possible. → no cookie banner needed if no non-essential cookies/trackers (confirm with counsel per jurisdiction).
- HN usernames displayed are public data from HN; we don't profile them or combine with other data.

## Data inventory template (keep in `docs/privacy/data-inventory.md`)
| Data | Source | Purpose | Lawful basis (GDPR) | Where stored | Processor | Retention | Shared? |
|---|---|---|---|---|---|---|---|
| Email address | digest signup | send digest | consent | Postgres (EU/US region?) | Supabase, email provider | until unsubscribe + 30 d | processors only |
| Saved topics | account | personalization | contract | Postgres | Supabase | account life | no |
| IP / user agent | requests | security, rate limit | legitimate interest | Netlify logs | Netlify | per Netlify log retention | no |
| Error events | Sentry | debugging | legitimate interest | Sentry | Sentry | 30–90 d | no |
| Analytics events | cookieless analytics | product improvement | legitimate interest or consent* | vendor | vendor | aggregated | no |
*Depends on tool and jurisdiction (ePrivacy rules on device storage); counsel to confirm.

## Feature checklists
**Email digests**
- [ ] Double opt-in; consent timestamp and source stored; no pre-ticked boxes.
- [ ] One-click unsubscribe link + `List-Unsubscribe` header; honor immediately.
- [ ] Sender identity and physical/postal contact as required (e.g. CAN-SPAM), privacy policy link.
- [ ] Email provider DPA signed; data region noted.

**Accounts**
- [ ] Collect only email (passwordless/magic link or OAuth); no names unless needed.
- [ ] Self-serve export (JSON) and delete-account; deletion cascades (data-modeling-storage).
- [ ] Supabase RLS on all user tables; service keys only in Functions.

**Analytics**
- [ ] Prefer cookieless, aggregate tools (e.g. Plausible/Fathom/Netlify Analytics-style server-side). No session replay, no ad pixels.
- [ ] If any non-essential cookies/identifiers: consent banner with equal "Reject" option before loading; honor Global Privacy Control.

**AI providers**
- [ ] Send no user data in prompts; check provider retention/training settings; list as processor if used with user data.

## Privacy policy outline (draft for attorney review)
1. Who we are and contact (privacy email). 2. What we collect (per inventory) and what we don't. 3. Why and lawful bases. 4. Cookies/local storage. 5. Processors/vendors list (Netlify, Supabase, email, Sentry, analytics, LLM). 6. International transfers. 7. Retention. 8. Your rights (access, deletion, correction, portability, objection; CCPA right to know/delete/opt-out; we don't sell/share personal info). 9. Children (not directed to under 13/16). 10. Security. 11. Changes. 12. Effective date.

## Data-subject request procedure
1. Receive at privacy email/form → log in private tracker (not public GitHub issues).
2. Verify identity via the account email.
3. Fulfil within the legal deadline (GDPR generally 1 month; CCPA 45 days, check current law): export or delete across Postgres, email provider, Sentry, analytics.
4. Confirm to requester; record completion date.

## Retention schedule defaults (to confirm)
Unsubscribed emails: 30 d · deleted accounts: immediate + backups rollover ≤ 35 d · error events: ≤ 90 d · function logs: platform default · research recordings: ≤ 90 d.

## Pitfalls
- Adding Google Analytics/ad pixels "temporarily".
- Feedback issues on public GitHub containing emails.
- Logging emails in Function logs or Sentry breadcrumbs.
- Using Algolia/HN data to profile HN users.

## Used by
- data-engineer
- legal-counsel
- privacy-compliance-officer
- growth-analytics-marketer
