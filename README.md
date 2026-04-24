# teamagent

**Claude Code plugin** that lets Claude consult Codex CLI and Gemini CLI as specialist subagents — no API keys, uses the user's existing CLI subscriptions.

## What it does

When you work in a repo with `teamagent` installed, Claude Code becomes a "team agent" with two on-call specialists:

| Specialist | When Claude invokes |
|---|---|
| **`codex:rescue`** | Precision refactors, adversarial code review, tight bug fixes |
| **`gemini-consult`** | Large-file/log/PDF/image scans, cheap parallel exploration |

The **three-signal rule** keeps orchestration overhead minimal: Claude consults a subagent only when one of these is clearly present — **parallelism**, **cross-verification**, or **context-window relief**. Everything else Claude does itself.

Structural defenses prevent known multi-agent failure modes (see [design spec](../plan/2026-04-24-teamagent-design.md)):
- **Tickets** with `acceptance_criteria` must be closed with structured evidence (hook enforces it).
- **Risk-gated peer review**: code touching sensitive paths or >3 files automatically routes through `codex:rescue` before close.
- **Write-scope enforcement**: concurrent writes to overlapping file sets are rejected with a hard error.
- **Memory allowlist**: `PROJECT_MEMORY.md` is not leaked to subagents unless the ticket explicitly opts in.

## Requirements

| Dependency | Why |
|---|---|
| Node.js 20+ | runs the companion scripts + hooks |
| Claude Code CLI (`claude`) | the top-level agent |
| Codex CLI (`codex`) | precision engineering subagent |
| Gemini CLI (`gemini`) | long-context/multimodal subagent |

Each CLI must already be **installed and authenticated** before using `teamagent`.

Verify:
```bash
claude --version
codex --version
gemini --version
```

## Install

```bash
# Clone into Claude Code plugins
git clone <this-repo-url> ~/.claude/plugins/teamagent
cd ~/.claude/plugins/teamagent
npm install

# Enable inside Claude Code
/plugin enable teamagent
/reload-plugins
```

> The plugin registers two hooks automatically:
> - `PostToolUse` on `Write|Edit` → `evidence-check.mjs` (blocks weak ticket closes)
> - `SessionStart` → `lifecycle-prune.mjs` (drops sidecar bodies older than 30 days)

## First run

Open Claude Code in any project:

```
> /teamagent:ticket new "scan src/ for deprecated api usage"
> scan src/ for any use of the deprecated legacyAuth() function
```

Claude will decide whether to invoke `gemini-consult` (parallel scan signal) and create a structured ticket under `.teamagent/tickets/`.

### Blackboard location

Tickets, audit logs, and sidecar files live in `.teamagent/` in the current working directory. Override:

```bash
export TEAMAGENT_BLACKBOARD_DIR=~/.teamagent/my-project
```

Add `.teamagent/` to your `.gitignore` (the `/teamagent:ticket new` command will suggest this on first run).

## Slash commands

| Command | Description |
|---|---|
| `/teamagent:ticket new "<title>"` | Create a ticket with full schema |
| `/teamagent:ticket done <id>` | Close ticket (evidence-check hook runs) |
| `/teamagent:ticket show <id>` | Print full ticket |
| `/teamagent:consult codex <task>` | Invoke codex:rescue directly |
| `/teamagent:consult gemini <task>` | Invoke gemini-consult directly |
| `/teamagent:status` | Dump open tickets + recent runs |

## Development

```bash
npm test                                      # unit + contract (no live CLIs)
TEAMAGENT_INTEGRATION=1 npm run test:integration   # live smoke (needs auth)
```

## Design

See [`../plan/2026-04-24-teamagent-design.md`](../plan/2026-04-24-teamagent-design.md) for the full v2.1 design spec — rationale, architecture, blackboard protocol, structural defenses, and open questions.

## License

MIT © 2026 kiyong
