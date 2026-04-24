---
description: Consult codex or gemini for a narrow, scoped task. Usage: /teamagent:consult <codex|gemini> <task text>
argument-hint: "<codex|gemini> <task text>"
---

Invoke the specified subagent with the given task text. Follow the three-signal rule from the teamagent-orchestration skill — do NOT invoke a subagent for work you can do yourself.

Arguments: $ARGUMENTS

- If the first token is `codex`, dispatch to `codex:rescue` with the remaining text.
- If the first token is `gemini`, dispatch to `teamagent:gemini-consult` with the remaining text.
- Otherwise, print usage: `/teamagent:consult <codex|gemini> <task text>` and stop.
