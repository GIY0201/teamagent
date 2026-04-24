---
description: Manage teamagent tickets. Usage: /teamagent:ticket new "<title>" | done <id> | show <id>
argument-hint: "new \"<title>\" | done <id> | show <id>"
---

Manage tickets under `.teamagent/tickets/`.

Arguments: $ARGUMENTS

### `new "<title>"`

Create a new ticket file at `.teamagent/tickets/YYYY-MM-DD-<seq>.md`.

If `.teamagent/tickets/` does not exist, create it. Also suggest the user add `.teamagent/` to their `.gitignore` if it is not already there.

Fill the frontmatter using the teamagent-orchestration skill's template:

```yaml
---
id: <YYYY-MM-DD-seq>
title: "<title>"
status: in_progress
owner: claude
goal: "<ask the user or infer from context>"
acceptance_criteria: []
constraints: []
prior_attempts: []
risk:
  touches_sensitive_paths: false
  file_count_estimate: 1
verify: auto
memory_include: []
write_scope: []
---

## Plan


## Work log


## Evidence

```

### `done <id>`

Attempt to set `status: done` on the ticket `<id>`. The `evidence-check.mjs` hook will block the write if Evidence is incomplete — read its refusal message and populate what's missing before retrying.

### `show <id>`

Read and print the full ticket contents.
