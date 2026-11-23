# Knowledge folder: Olu (Data Engineer)

Agent: `data-engineer` (A12). This agent **reads this folder before every answer**.

## What belongs here
Documents that give Olu project-specific context beyond `docs/` and the agent's skills:
- Schemas
- migration history
- storage cost/usage
- retention policies
- data dictionaries

## Guidelines
- Use Markdown, plain text, CSV or JSON. Name files with a date where useful, e.g. `2026-11-23-pricing-snapshot.md`.
- Keep each file focused. Put a one-line summary at the top.
- **Never store secrets** (API keys, passwords, tokens) or personal data that isn't needed.
- Newer files win when they conflict with older ones. Delete or mark files `OUTDATED` when superseded.
- Shared, team-wide facts belong in `docs/`, not here.
