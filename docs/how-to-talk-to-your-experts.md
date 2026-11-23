# How to Talk to Your Experts

There are three ways to reach the 29-agent team (see [CLAUDE.md](../CLAUDE.md) for the full roster): ask **one expert**, ask **the whole team**, or give the orchestrator a **cross-functional prompt** and it decides who's needed.

---

## 1. Ask one specific expert

Use this when the question clearly belongs to one role.

**@-mention** (type `@` and pick from the list, or type it out):

```text
@agent-legal-counsel Can we name the app "HN Pulse", or does that imply a Y Combinator affiliation?
```

```text
@agent-qa-test-engineer Write the test plan for the docs/07 edge cases before we start coding.
```

**Or name the agent in plain English:**

```text
Use the finops-analyst subagent to estimate our monthly Netlify and Algolia cost at 1,000 daily users.
```

The expert answers alone, using its own preloaded skills.

---

## 2. Ask the whole team

Use this when you don't know who should answer, or the question touches several areas. The orchestrator picks the experts, runs them in parallel, and gives you **one combined answer**.

**Option A: start the session as the orchestrator (recommended).** Everything you type then goes through it, and it can call any expert freely:

```bash
claude --agent expert-orchestrator
```

**Option B: from a normal session, @-mention it:**

```text
@agent-expert-orchestrator Ask the team: what are the top five risks to shipping the MVP in four weeks?
```

Phrases like "ask the team", "consult the experts" or "get everyone's input" also steer Claude to the orchestrator.

**What you get back:**
- **Answer / Recommendation**
- **Who was consulted and why**
- **Key points per expert**
- **Conflicts and how they were resolved**
- **Risks**
- **Open questions for you**
- **Next actions, each with an owner agent**

---

## 3. Example prompts that make experts work together

Each of these is built to need several experts at once. Paste it as-is, either into a `claude --agent expert-orchestrator` session or after `@agent-expert-orchestrator`.

### Example 1: Go/no-go on AI summaries
```text
Should we add AI-generated summaries of each story and its HN discussion to the MVP, or wait for V2?
Give me a single recommendation covering user value, build effort, monthly cost at 500 and 5,000 users,
legal/copyright risk of summarizing third-party articles, and privacy implications.
```
**Likely experts:**
- `product-owner`: scope and value
- `ai-ml-engineer`: approach and effort
- `finops-analyst`: LLM cost
- `legal-counsel`: copyright and terms
- `privacy-compliance-officer`: data sent to the LLM
- `solution-architect`: how it fits on Netlify

### Example 2: Launch-readiness review
```text
We want to launch publicly next month with a Show HN post. Run a launch-readiness review:
what must be true technically, legally, and from a marketing/community standpoint before we post?
Give me a single checklist with an owner for each item, and flag anything that blocks launch.
```
**Likely experts:**
- `product-owner`
- `qa-test-engineer`
- `devops-netlify-engineer`
- `security-engineer`
- `legal-counsel`
- `privacy-compliance-officer`
- `hn-community-expert`
- `community-manager`
- `product-marketing-strategist`

### Example 3: Architecture plus cost decision for live updates
```text
Decide how "live" the feed should be on Netlify: browser EventSource straight to HN Firebase,
a Scheduled Function polling every 1 vs 5 minutes into Netlify Blobs, or both.
Compare freshness, reliability, cost at 1,000 daily users, and the UX of the "N new stories" pill.
Record the decision as an ADR.
```
**Likely experts:**
- `solution-architect`: ADR owner
- `performance-realtime-engineer`
- `hn-api-integration-engineer`
- `frontend-engineer`
- `finops-analyst`
- `ui-designer`

### Example 4: Personalized topic feeds and email digests
```text
I want to follow only AI, security and Rust news and get a 7am email digest of the top 10 stories.
Design this feature end to end: topic rules, ranking, data storage, the email pipeline on Netlify,
what we must do for GDPR/CCPA if we store emails, and whether this could become a paid tier.
```
**Likely experts:**
- `tech-news-editor`: topic rules
- `search-discovery-engineer`: ranking
- `data-engineer`: storage and digest pipeline
- `privacy-compliance-officer`
- `business-model-analyst`
- `ux-researcher`
- `product-owner`

---

## 4. Tips for better answers

- **Give constraints.** Budget, deadline, number of users, and whether it's MVP or V2.
- **Say what form you want.** For example: "one-page recommendation", "checklist with owners", "ADR", or "user stories with acceptance criteria".
- **Name experts if you care who weighs in.** For example: "…and make sure legal-counsel and finops-analyst review it."
- **Follow up in the same session.** For example: "Now have the frontend-engineer and qa-test-engineer turn the decision into tasks."
- **To change the team itself**, use the meta agent:

  ```text
  @agent-agent-architect Add a mobile-engineer agent that uses frontend-framework and realtime-streaming-sse.
  ```
