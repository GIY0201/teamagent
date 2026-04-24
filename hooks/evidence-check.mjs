// hooks/evidence-check.mjs
// PostToolUse hook on Write|Edit matching .teamagent/tickets/**/*.md.
// Blocks setting status: done unless evidence rules pass (design spec §6.3).

import { readFileSync } from 'node:fs';
import YAML from 'yaml';

const STRUCTURED_PATTERNS = [
  /```diff[\s\S]*?```/, // file diff block
  /```bash[\s\S]*?```/, // command + exit-code
  /```(?:sh|shell|console)[\s\S]*?```/,
  /```(?:python|js|ts|json|yaml|tsx|jsx)[\s\S]*?```/, // code/output block
  /\[[^\]]+\]\([^)]+\)/, // citation / URL link
  /\b[\w/.-]+:\d+\b/, // path:line reference
];

/**
 * @param {string} ticketText full markdown of the ticket
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateTicketCompletion(ticketText) {
  const fmMatch = ticketText.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { ok: true }; // no frontmatter, leave alone
  let fm;
  try {
    fm = YAML.parse(fmMatch[1]);
  } catch {
    return { ok: false, reason: 'Frontmatter is not valid YAML.' };
  }
  if (fm?.status !== 'done') return { ok: true };

  // Capture everything under "## Evidence" until the next "## " heading or end of input.
  // Do NOT use /m flag here — it would make $ match end-of-line and truncate the body.
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
// Invoked by Claude Code on PostToolUse. Input: JSON on stdin.
// Block signal: exit code 2 + JSON `{decision:"block", reason:"..."}` on stdout.

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  process.stdin.on('data', (d) => {
    raw += d;
  });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(raw);
      const path = payload?.input?.file_path ?? '';
      // Scope: only ticket files under .teamagent/tickets/
      if (!/\.teamagent[/\\]tickets[/\\].+\.md$/.test(path)) {
        process.exit(0);
      }
      const text = readFileSync(path, 'utf8');
      const r = validateTicketCompletion(text);
      if (r.ok) process.exit(0);
      process.stdout.write(JSON.stringify({ decision: 'block', reason: r.reason }));
      process.exit(2);
    } catch (e) {
      process.stderr.write(`evidence-check error: ${e.message}\n`);
      // Fail-open: hook bugs must not lock the user out.
      process.exit(0);
    }
  });
}
