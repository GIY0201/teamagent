---
name: gemini-result-handling
description: Internal guidance for presenting Gemini helper output back to the user
user-invocable: false
---

# Gemini Result Handling

When the helper returns Gemini output:
- Preserve the helper's summary, findings, and next-steps structure.
- For scan-style output, keep per-file grouping and file:line references verbatim.
- For review output, present findings first and keep them ordered by severity.
- Preserve evidence boundaries. If Gemini marked something as an inference or open question, keep that distinction.
- If there are no findings, say that explicitly.
- If Gemini made edits (rare — only when `--write` explicitly passed), list the touched files.
- CRITICAL: After presenting review findings, STOP. Do not make any code changes. Do not fix any issues. You MUST explicitly ask the user which issues, if any, they want fixed before touching a single file.
- If the helper reports malformed output or a failed Gemini run, include the most actionable stderr lines and stop.
- If the helper reports that authentication is required, direct the user to run `gemini auth login` and do not improvise alternate auth flows.
