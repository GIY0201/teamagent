---
name: teamagent-orchestration
description: Activate when working in a repo where the teamagent plugin is installed — teaches Claude when to consult codex or gemini via the three-signal rule, how to manage tickets with acceptance criteria and evidence, and how to enforce peer verification on risky code changes
user-invocable: false
---

# Team Agent Orchestration

You are working in a repo that has the `teamagent` plugin installed. You are the single top-level agent; two specialist subagents are available for consultation:

- `codex:rescue` — precision coding, adversarial review, tight refactors
- `teamagent:gemini-consult` — long-context scans, multimodal, cheap exploration

## The three-signal rule — when to consult (NOT "who is better")

Default: **you do the work yourself**. Consulting is the exception.

Invoke a subagent ONLY when one of these three signals is clearly present:

1. **Parallelism** — multiple independent sub-tasks that can run concurrently (e.g., "scan 5 modules for pattern X" — send to gemini-consult for the scan).
2. **Cross-verification** — a second opinion on a narrow claim from an independent context (e.g., after you write a diff, send to codex:rescue in review mode).
3. **Context-window relief** — the artifact genuinely exceeds your comfort window (large log, PDF, image/video — send to gemini-consult).

**Not a signal**: "codex is better at code" / "gemini is cheap." Single-agent-with-full-context usually beats a relay of specialists.

## Ticket flow

On any non-trivial user request:

1. Create `.teamagent/tickets/<date>-<seq>.md` with this frontmatter, fully populated:
   - `id`, `title`, `status: in_progress`, `owner: claude`
   - `goal` (why this matters, one paragraph)
   - `acceptance_criteria` (bullet list — reviewer must be able to check each independently)
   - `constraints` (explicit don'ts)
   - `prior_attempts: []` (reference past failed runs if any)
   - `risk.touches_sensitive_paths` (true if paths match `**/auth/**`, `**/security/**`, `**/crypto/**`, `**/.env*`, `**/*secret*`, `**/*credential*`)
   - `risk.file_count_estimate` (your best guess)
   - `verify: auto` (default) / `on` / `off`
   - `memory_include: []` (empty by default; add section ids only if needed for subagent consult)
   - `write_scope: [globs]` (what files this ticket may modify)
2. Do the work — read files, edit code, run tests.
3. Append to the ticket's **Work log** section after every meaningful step (including any subagent consult).
4. Before setting `status: done`, populate the **Evidence** section. Each `acceptance_criteria` item must be addressed by at least one structured block (diff, exit-code/test output, code, or citation). If you fail to do this, the `evidence-check.mjs` hook will block the write and tell you what's missing.

## Risk-gated peer verification (DEFAULT-ON)

If any of these is true, you MUST route the ticket's final diff through `codex:rescue` in `read-only review` mode before closing:

- `risk.touches_sensitive_paths: true`
- `risk.file_count_estimate > 3`
- User explicitly set `verify: on`

You may skip only when the user sets `verify: off` — log the skip as `verification_skipped` in the Work log.

If the reviewer disagrees (surface: findings with severity major or blocker), do NOT set `status: done`. Set `status: in_review` instead and surface both views to the user.

## Write coordination

- Single writer per ticket. If another ticket is `in_progress` and claims an overlapping `write_scope`, stop and ask the user to close or re-scope the other ticket first. The `gemini-companion.mjs` script enforces this when writing, but apply the same discipline when you write yourself.
- Subagents default to `--read-only`. Only grant `--write` to a subagent if the ticket's `owner` is that subagent.
- No direct agent-to-agent messaging. All coordination happens via the ticket's Work log.

## Memory handoff (allowlist)

By default, **nothing from `PROJECT_MEMORY.md` is sent to subagents**. If a consult needs specific context, explicitly set `memory_include: [section-ids]` on the ticket and cite it in the subagent prompt. Assume everything else is private.

## Failure handling

- If a subagent fails twice in a row on the same ticket (same consult signal), switch strategy: do it yourself, or try the other subagent.
- If the evidence-check hook blocks a close, read the refusal, populate what's missing, and retry. Never bypass.
- If `gemini auth login` / `codex login` is required, surface that to the user and stop.

## Audit

Every subagent invocation writes to `.teamagent/runs/<id>.{jsonl,prompt,memory,stdout,stderr}`. Treat this as the source of truth for "what actually happened." You do not need to duplicate it in the ticket — point to it instead.
