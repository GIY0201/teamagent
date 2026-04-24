---
name: gemini-cli-runtime
description: Internal helper contract for calling the gemini-companion runtime from Claude Code
user-invocable: false
---

# Gemini Runtime

Use this skill only inside the `teamagent:gemini-consult` subagent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/gemini-companion.mjs" task --prompt "<text>" [flags]`

Execution rules:
- The consult subagent is a forwarder, not an orchestrator. Its only job is to invoke `task` once and return that stdout unchanged.
- Prefer the helper over hand-rolled `gemini` strings.
- Leave `--model` unset unless the user explicitly requests one.
- Default to `--read-only`. Add `--write` only when the ticket owner is `gemini` and the user explicitly asked for edits.

Runtime control flags (standardized across teamagent CLIs):
- `--read-only` / `--write`
- `--fresh` / `--resume` (routing — strip from prompt text before passing)
- `--model <id>`
- `--timeout <sec>` (default 300)
- `--blackboard-dir <path>` (default `.teamagent` in cwd)
- `--write-scope <glob>` (repeatable — required with `--write`)
- `--dry-run` (diagnostics; prints argv + writes audit, does not spawn gemini)

Safety rules:
- Default to read-only.
- Preserve the user's task text as-is apart from stripping routing flags.
- Do not inspect the repo, read files, grep, monitor progress, poll status, fetch results, cancel jobs, or summarize output.
- Return the stdout of the `task` command exactly as-is.
- If the Bash call fails, return nothing.
