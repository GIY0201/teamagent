---
description: Dump blackboard state — open tickets, recent runs.
---

Summarize `.teamagent/` state:

1. List all ticket files under `.teamagent/tickets/` with their `id`, `status`, `title`, `owner`. Sort by `created` descending.
2. List the most recent 10 audit JSONL files under `.teamagent/runs/` with a one-line summary each: cli, event count, last event kind.
3. Report the total sidecar size under `.teamagent/runs/` (sum of `.prompt`, `.memory`, `.stdout`, `.stderr` files).
4. If `.teamagent/` does not exist, say so and suggest running `/teamagent:ticket new` to initialize.
