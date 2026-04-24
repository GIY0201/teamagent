// hooks/evidence-check.mjs
// PostToolUse hook on Write|Edit matching .teamagent/tickets/**/*.md.
// Blocks setting status: done unless evidence rules pass (design spec §6.3).

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

const STRUCTURED_PATTERNS = [
  /```diff[\s\S]*?```/, // file diff block
  /```bash[\s\S]*?```/, // command + exit-code
  /```(?:sh|shell|console)[\s\S]*?```/,
  /```(?:python|js|ts|json|yaml|tsx|jsx)[\s\S]*?```/, // code/output block
  /\[[^\]]+\]\([^)]+\)/, // citation / URL link
  /\b[\w/.-]+:\d+\b/, // path:line reference
];

/** Normalize text: strip BOM + CRLF so regexes work on Windows-created files. */
function normalize(text) {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

/**
 * @param {string} rawTicketText full markdown of the ticket (not yet normalized)
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateTicketCompletion(rawTicketText) {
  const ticketText = normalize(rawTicketText);
  const fmMatch = ticketText.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { ok: true }; // no frontmatter — leave alone

  let fm;
  try {
    fm = YAML.parse(fmMatch[1]);
  } catch {
    return { ok: false, reason: 'Frontmatter is not valid YAML.' };
  }
  if (fm?.status !== 'done') return { ok: true };

  // acceptance_criteria must be an array when status is done (Codex P1 fix).
  if (fm.acceptance_criteria !== undefined && !Array.isArray(fm.acceptance_criteria)) {
    return {
      ok: false,
      reason:
        'acceptance_criteria must be a YAML array (e.g. ["criterion-A", "criterion-B"]) when status is done.',
    };
  }

  // Capture everything under "## Evidence" until the next "## " heading or end of input.
  // Do NOT use /m flag — it makes $ match end-of-line and truncates the body.
  const evMatch = ticketText.match(/(?:^|\n)## Evidence\s*\n([\s\S]*?)(?=\n## |$)/);
  const body = (evMatch?.[1] ?? '').trim();
  if (!body) return { ok: false, reason: 'Evidence section is empty.' };

  const hasStructured = STRUCTURED_PATTERNS.some((re) => re.test(body));
  if (!hasStructured)
    return {
      ok: false,
      reason:
        'Evidence must contain at least one structured block: diff, exit-code/test output, code, or citation.',
    };

  const criteria = Array.isArray(fm.acceptance_criteria) ? fm.acceptance_criteria : [];
  const missing = criteria.filter((c) => !body.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `Missing reference to acceptance_criteria: ${missing
        .map((m) => JSON.stringify(m))
        .join(', ')}`,
    };
  }
  return { ok: true };
}

// ---------- hook entry point ----------
// Invoked by Claude Code PostToolUse. Input: JSON on stdin.
// Block signal: exit code 2 + JSON `{decision:"block", reason:"..."}` on stdout.

// Use pathToFileURL for Windows-safe comparison (Codex P0 fix):
//   import.meta.url = "file:///C:/..." but process.argv[1] = "C:\..."
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  let raw = '';
  process.stdin.on('data', (d) => {
    raw += d;
  });
  process.stdin.on('end', () => {
    let payload;
    // Phase 1: parse JSON. Unexpected payload → block (Codex P1: narrow fail-open).
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      process.stderr.write(`evidence-check: bad hook payload: ${e.message}\n`);
      // Malformed JSON from the harness is unexpected — fail-open so we don't brick CC.
      process.exit(0);
    }

    const filePath = payload?.input?.file_path ?? '';
    // Phase 2: scope check — only ticket files.
    if (!/\.teamagent[/\\]tickets[/\\].+\.md$/.test(filePath)) {
      process.exit(0); // not a ticket → allow
    }

    // Phase 3: read + validate. Errors here are operational (bad symlink, race) → block
    // with a diagnostic rather than fail-open.
    let text;
    try {
      text = readFileSync(filePath, 'utf8');
    } catch (e) {
      // File should exist (we're in PostToolUse after a Write/Edit).
      // Fail-open with a warning so a broken file doesn't permanently block.
      process.stderr.write(`evidence-check: cannot read ticket (${e.message}) — skipping.\n`);
      process.exit(0);
    }

    let r;
    try {
      r = validateTicketCompletion(text);
    } catch (e) {
      process.stderr.write(`evidence-check: validator crashed (${e.message}) — skipping.\n`);
      process.exit(0);
    }

    if (r.ok) process.exit(0);
    process.stdout.write(JSON.stringify({ decision: 'block', reason: r.reason }));
    process.exit(2);
  });
}
