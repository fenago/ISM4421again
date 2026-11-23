# 2026-11-23: Naming opinion on "HN Pulse"
Summary: Usable with conditions for private/early use; **rename before any public launch**. The main conflict is "Pulse for Hacker News", not YC.

> **Not legal advice.** AI-prepared, for information only. Have a qualified attorney review it before a public launch, App Store listing or monetization.

**Status:** Advice given to Dr. Lee. No final name chosen yet. No trademark search done yet.

## Findings
- **"Pulse" conflict (main issue):** an existing third-party client, **"Pulse for Hacker News"** (App Store id6504872454; Android package `com.jarvislin.hackernews`), was found via search on 2026-11-23. "HN Pulse" would look like that app or a version of it. "Pulse" is also a crowded mark: a well-known news reader acquired by LinkedIn, and LinkedIn still uses "Pulse" for articles. Current registrations not verified.
- **"HN" / Hacker News / Y Combinator:** YC's brands. Registration status not confirmed. Leading with "HN" reads like a first-party product more than the descriptive pattern "<Name> for Hacker News". The orange "Y" square and HN's orange header are the strongest affiliation signals.
- **Common pattern among third-party clients:** "<Name> for Hacker News" (e.g. HACK, Hackers, Hazumi, Pulse). Their non-affiliation disclaimers were **not** verified.
- **Primary sources checked:** the HN API README (github.com/HackerNews/API) sets no data terms, says nothing about trademarks, and states "There is currently no rate limit." **Not yet checked:** news.ycombinator.com/legal, which was blocked by the session's network settings.

## Risk by scenario ("HN Pulse")
| Scenario | Risk |
|---|---|
| Private or personal use | Low |
| Free public web app or Show HN | Low to Medium |
| Paid or monetized | Medium |
| App Store listing | Medium to High |

## Conditions if the name is used (even temporarily)
1. No HN/YC logo, no orange "Y" square, no copy of HN's orange header.
2. Never use "Official", "YC" or "Y Combinator" in the name, domain or social handles.
3. Put this disclaimer in the footer of every page and in the README and About page:
   > "HN Pulse is an independent, unofficial reader. Data from Hacker News via the official API; search by HN Search powered by Algolia. Not affiliated with or endorsed by Y Combinator or Hacker News."
4. Every story links to its original URL and its HN thread (`https://news.ycombinator.com/item?id={id}`), and authors are credited as `by {username}`.
5. Rename immediately if YC or the other Pulse developer gets in touch.

## Lower-risk alternatives (not yet cleared)
Threadline, Topicscope, Byteline, Frontpage Radar, Kernelfeed. Put the HN mention in a subtitle ("…, a reader for Hacker News") rather than in the name.

## Open follow-ups
- [ ] USPTO trademark search: "HN Pulse", "Pulse" (classes 9, 41, 42) and the alternatives. Also check the App Store, Google Play, GitHub and domains. Owner: product-owner.
- [ ] Allow news.ycombinator.com in the environment's network settings so the HN legal page can be checked.
- [ ] Optional courtesy email to YC if "HN" stays in the name. Verify the contact address and keep the reply on file here.
- [ ] Attorney sign-off before Show HN, an App Store submission or monetization. Work with product-marketing-strategist (Zara) on the final name.

## Sources
- https://github.com/HackerNews/API
- https://apps.apple.com/sg/app/pulse-for-hacker-news/id6504872454
- https://appgoblin.info/apps/com.jarvislin.hackernews
- https://apps.apple.com/us/app/id1464477788 (HACK)
- https://apps.apple.com/app/id1670237209 (Hazumi)
- https://apps.apple.com/app/id603503901 (Hackers)
