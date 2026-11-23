---
name: git-github-ci
description: Defines the GitHub workflow for the HN app - trunk-based branching off a protected main, PR conventions and template, required checks, a GitHub Actions CI pipeline (typecheck, lint, unit/fixture tests, build, Playwright) and how it pairs with Netlify deploy previews and production deploys. Use when creating branches or PRs, writing or fixing .github/workflows, setting branch protection, or deciding what must pass before merge.
metadata:
  id: S07
  used-by: [product-owner, project-manager, solution-architect, hn-api-integration-engineer, frontend-engineer, qa-test-engineer, devops-netlify-engineer, technical-writer]
  mvp: true
---
# Git / GitHub Workflow & CI

## Purpose
GitHub is the source of truth and the deploy trigger: PR -> Netlify deploy preview + CI checks -> merge to `main` -> Netlify production deploy ([expert-roster section 3](../../../docs/expert-roster.md#3-path-to-a-live-app-with-the-mvp-team)).

## When to use
Starting any change, opening/reviewing a PR, editing `.github/`, or configuring branch protection.

## Branching
- Trunk-based: short-lived branches off `main`, merged within days.
- Names: `feat/live-pill`, `fix/null-item-crash`, `chore/ci-cache`, `docs/adr-0003-blobs`. Agent sessions may use their assigned branch name.
- Never commit directly to `main`; never force-push shared branches.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`), imperative, one logical change.

## Protected `main` (repo settings -> Branches)
- [ ] Require a pull request before merging; 1 approval (QA or architect for risky areas).
- [ ] Require status checks: `ci / verify`, `ci / e2e`, and the Netlify deploy-preview check.
- [ ] Require branches up to date before merge.
- [ ] Require conversation resolution; block force pushes and deletion.
- [ ] Squash merge as default (clean history = one commit per PR).

## PR conventions
`.github/pull_request_template.md`:
```markdown
## What & why
<!-- Link issue/story. One paragraph. -->
## Acceptance criteria
- [ ] ...copied from the story (see requirements-acceptance-criteria skill)
## How tested
- [ ] Unit/fixture tests  - [ ] Playwright  - [ ] Checked on deploy preview
## Edge cases from docs/07 touched?
## Screenshots (UI)
## ADR needed? (link docs/adr/NNNN-*.md)
```
Keep PRs < ~400 changed lines; split otherwise.

## CI pipeline
```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck        # tsc --noEmit
      - run: npm run lint
      - run: npm test -- --coverage   # vitest, fixtures only (no live HN)
      - run: npm run build
      - run: npm audit --audit-level=high
  e2e:
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build && npm run test:e2e   # Playwright webServer serves build; HN/Algolia mocked
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report }
```
Optional `live-smoke.yml` on `schedule: - cron: "17 */6 * * *"` running `HN_LIVE=1 npm run test:live` - a contract check against real HN/Algolia that **never** blocks PRs.

Recommended `package.json` scripts: `typecheck`, `lint`, `test`, `test:e2e`, `test:live`, `build`, `format`.

## Netlify pairing
- Netlify (not Actions) builds and deploys: link the repo in Netlify; build settings come from `netlify.toml`.
- Deploy preview URL is posted on every PR; reviewers click through the actual feature there.
- Merge to `main` = production deploy. Rollback via Netlify "Publish deploy" on a prior build, then fix forward with a revert PR (`git revert <sha>`).
- Optional: Dependabot (`.github/dependabot.yml`, weekly npm + github-actions).

## Agent workflow checklist
1. `git switch -c feat/<thing>` from up-to-date `main`.
2. Small commits; run `npm run typecheck && npm test` before pushing.
3. Open PR with template filled; link story and ADR.
4. Wait for CI + deploy preview; QA verifies acceptance criteria on the preview.
5. Squash merge; delete branch; confirm production deploy is green.

## Pitfalls
- Tests that call live `hacker-news.firebaseio.com` in CI -> flaky (and blocked in our sandbox with 403).
- Committing `.env`, `.netlify/` state, or `playwright-report/`. Add them to `.gitignore`.
- Workflow `permissions` left at default write - set `contents: read`.
- Running Netlify deploys from Actions *and* Git integration -> double deploys.

## Used by
product-owner, project-manager, solution-architect, hn-api-integration-engineer, frontend-engineer, qa-test-engineer, devops-netlify-engineer, technical-writer
