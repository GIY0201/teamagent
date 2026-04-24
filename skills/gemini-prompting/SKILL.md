---
name: gemini-prompting
description: Prompt templates for the three teamagent consult signals (parallel scan, cross-verify, context-window relief)
user-invocable: false
---

# Gemini Prompting

Use when composing the task text passed to `gemini-consult`. Pick the template that matches the signal, fill in the placeholders, then forward.

## Template 1 — Parallel scan / codebase sweep (context-window relief)

```
You will scan the following files/paths for the requested pattern and return a structured report.

Goal: <one paragraph from the ticket>

Targets:
- <path 1>
- <path 2>
- ...

What to look for: <pattern, concern, or question>

Output format:
- One finding per file:line.
- End with a short summary (≤3 bullets).
- If nothing matches, say so explicitly.
```

## Template 2 — Cross-verification / diff review

```
Review the following diff for correctness with respect to the goal.

Goal: <ticket goal>
Acceptance criteria: <bullet list>

Diff:
<unified diff or file paths to read>

Return:
- Findings ordered by severity (blocker / major / minor / nit).
- For each, quote the offending line.
- Separate observed-facts from inferences.
- Do not propose the fix unless asked.
```

## Template 3 — Long-document analysis

```
Summarize the following document against the specific question.

Question: <what the user actually wants to know>
Document: <path or pasted text>

Return:
- Direct answer first (≤3 sentences).
- Supporting citations as path:line or page number.
- Open questions at the end.
```
