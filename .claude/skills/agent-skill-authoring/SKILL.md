---
name: agent-skill-authoring
description: Authors and maintains Claude Code subagents (.claude/agents/<name>.md) and skills (.claude/skills/<name>/SKILL.md) for the HN app's expert team, covering exact frontmatter fields, wiring skills to agents, and keeping team-spec.json, CLAUDE.md and docs/expert-roster.md in sync. Use when asked to "add a new agent", "create a skill", "fix agent frontmatter", "wire skills to an agent", "update the roster", or to validate the team configuration.
metadata:
  id: S33
  used-by: [agent-architect]
  mvp: false
---
# Agent & Skill Authoring

## Purpose
Create and change team members (subagents) and their knowledge (skills) in the precise Claude Code formats, and keep every place that describes the team consistent.
Sources: https://code.claude.com/docs/en/sub-agents and https://code.claude.com/docs/en/skills (re-check for new fields; formats evolve).

## When to use
- Adding/removing/renaming an agent or skill; changing an agent's tools, model or skills.
- Validating the team after edits.

## Subagent format: `.claude/agents/<name>.md`
```markdown
---
name: data-engineer               # required; lowercase-hyphen; must not contain ':'
description: Designs storage ... Use proactively when ...   # required; tells Claude WHEN to delegate
tools: Read, Grep, Glob, Bash     # optional comma list; omit to inherit all tools
disallowedTools: Write            # optional deny list
model: sonnet                     # sonnet | opus | haiku | fable | inherit | full model id
permissionMode: default           # optional
maxTurns: 30                      # optional
skills:                           # optional; full SKILL.md content is injected at startup
  - data-modeling-storage
  - privacy-data-protection
mcpServers: ...                   # optional
hooks: ...                        # optional
memory: project                   # optional: user | project | local
background: false                 # optional
effort: medium                    # optional: low .. max
isolation: worktree               # optional
color: blue                       # optional: red|blue|green|yellow|purple|orange|pink|cyan
---
<system prompt: role, mission for THIS app, responsibilities, how to work, output format, boundaries>
```
- The body is the agent's whole system prompt; it does not see the parent conversation.
- `description` drives automatic delegation: lead with the role, include trigger phrases ("Use when…").
- Preloaded `skills:` cost context on every start; list only skills the agent truly needs (use team-spec.json).

## Skill format: `.claude/skills/<name>/SKILL.md`
```markdown
---
name: tech-news-taxonomy          # lowercase-hyphen, matches folder
description: What it does + when to use it (key use case first, third person, trigger phrases)
when_to_use: optional extra triggers   # description + when_to_use truncated at 1536 chars
argument-hint: "[topic-id]"            # optional
arguments: ...                          # optional named args
disable-model-invocation: false         # true = only the user can invoke (/name)
user-invocable: true                    # false = hidden from slash menu
allowed-tools: Read, Grep               # optional
disallowed-tools: Bash                  # optional
model: inherit                          # optional
effort: medium                          # optional
context: fork                           # optional: run in a forked subagent context
agent: data-engineer                    # optional: which agent runs a forked skill
paths: ["src/topics/**"]                # optional: auto-activate for matching files
metadata: { id: S14, used-by: [...], mvp: false }
---
# Title
Body: purpose, when to use, core knowledge, procedures/checklists/templates, pitfalls, used by.
```
- Substitutions in the body: `$ARGUMENTS` (all args), `$0`, `$1`… (positional), `$name` (named argument).
- Keep SKILL.md **under 500 lines**; put long references in supporting files in the same folder and link them by relative path (e.g. `[rules](rules.md)`), so they load only when needed.

## Team conventions (this repo)
- `.claude/team-spec.json` is the source of truth: `agents[]` (`id`, `name`, `title`, `job`, `skills`, `mvp`) and `skills[]` (`id`, `name`, `title`, `covers`, `used_by`, `mvp`). IDs: agents `A##`/`X##`, skills `S##`.
- Skill frontmatter carries `metadata.id`, `metadata.used-by`, `metadata.mvp` mirroring the spec.
- Every skill body ends with a "Used by" list matching `used_by`.
- Legal/privacy skills and agents include the "not legal advice; have a licensed attorney review" note.

## Procedure: add a new agent
1. Confirm the gap (no existing agent covers it) with product-owner/expert-orchestrator.
2. Update `.claude/team-spec.json`: add the agent (next free `A##`), its `skills`; add the agent name to each referenced skill's `used_by`.
3. Create `.claude/agents/<name>.md` with frontmatter (`name`, `description`, `tools`, `model`, `skills:` = spec skills, `color`) and a project-specific system prompt.
4. Update every referenced skill's `metadata.used-by` and "Used by" section.
5. Add a routing row to `.claude/skills/team-orchestration/SKILL.md`.
6. Update `CLAUDE.md` (team list/how to invoke) and `docs/expert-roster.md` (roster table + skills matrix).
7. Validate (below).

## Procedure: add a new skill
1. Add to `team-spec.json` `skills[]` (next free `S##`, `used_by`); add its name to each user agent's `skills`.
2. Create `.claude/skills/<name>/SKILL.md` (format above; project-specific content).
3. Add the skill to each user agent's `skills:` frontmatter list.
4. Update `docs/expert-roster.md` skills matrix and `CLAUDE.md` if it lists skills.
5. Validate.

## Validation script (run from repo root)
```bash
python3 - <<'PY'
import json, re, pathlib, sys
spec = json.load(open(".claude/team-spec.json")); err = []
def fm(p):
    t = p.read_text(); m = re.match(r"^---\n(.*?)\n---\n", t, re.S)
    if not m: err.append(f"{p}: no frontmatter"); return {}
    import yaml; return yaml.safe_load(m.group(1)) or {}
skills = {s["name"] for s in spec["skills"]}; agents = {a["name"] for a in spec["agents"]}
for kind, names in (("skills", [s["name"] for s in spec["skills"]]), ("agents", [a["name"] for a in spec["agents"]])):
    if len(names) != len(set(names)): err.append(f"duplicate {kind} names")
for s in spec["skills"]:
    p = pathlib.Path(f".claude/skills/{s['name']}/SKILL.md")
    if not p.exists(): err.append(f"missing {p}"); continue
    d = fm(p)
    if d.get("name") != s["name"]: err.append(f"{p}: name mismatch")
    if not d.get("description"): err.append(f"{p}: no description")
    if len(p.read_text().splitlines()) >= 500: err.append(f"{p}: >= 500 lines")
    bad = set(s["used_by"]) - agents
    if bad: err.append(f"{s['name']}: unknown used_by {bad}")
for a in spec["agents"]:
    p = pathlib.Path(f".claude/agents/{a['name']}.md")
    if not p.exists(): err.append(f"missing {p}"); continue
    d = fm(p)
    if d.get("name") != a["name"] or ":" in a["name"]: err.append(f"{p}: bad name")
    for k in d.get("skills") or []:
        if k not in skills: err.append(f"{p}: unknown skill {k}")
    if set(d.get("skills") or []) != set(a["skills"]): err.append(f"{p}: skills differ from spec")
print("\n".join(err) or "OK"); sys.exit(1 if err else 0)
PY
```
(Requires PyYAML: `pip install pyyaml`.) Also run `claude` and check `/agents` lists the agent and the skill appears in `/skills` (or the skills listing).

## Pitfalls
- `name` with `:` or uppercase; folder name ≠ skill `name`.
- Vague `description` → agent never auto-delegated / skill never triggered.
- Editing an agent's `skills:` without updating team-spec.json and the skill's `used-by`.
- Giving every agent every tool; scope tools to the role (e.g. legal-counsel: Read, Grep, Glob, WebFetch).
- SKILL.md bloat over 500 lines; split into supporting files.
- Forgetting CLAUDE.md/docs/expert-roster.md, so humans see a stale team.

## Used by
- agent-architect
