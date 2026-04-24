#!/usr/bin/env node
// scripts/gemini-companion.mjs
// Entry: node scripts/gemini-companion.mjs task [flags] --prompt <text>
// Flags:
//   --dry-run                      do not spawn gemini; still write audit + sidecars
//   --read-only / --write          toggle write capability
//   --blackboard-dir <path>        override `.teamagent/` location
//   --model, --timeout <sec>       standard runtime flags
//   --fresh, --resume              session control (future)
//   --write-scope <glob>           repeatable; checked against open tickets

import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import {
  spawnWithTimeout,
  writeSidecar,
  writeAuditEvent,
  truncateBytes,
  sha256,
} from './lib/common.mjs';
import { buildGeminiArgs, classifyGeminiError } from './lib/gemini.mjs';

// ---------- small glob matcher ----------

/** Very small glob matcher: supports `**` (any depth) and `*` (one segment). */
function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = esc
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp(`^${re}$`);
}
function globMatchAny(path, globs) {
  return globs.some((g) => globToRegex(g).test(path));
}

/** Read tickets currently in_progress and return their write_scope declarations. */
function openTicketScopes(blackboard) {
  const dir = join(blackboard, 'tickets');
  if (!existsSync(dir)) return [];
  const result = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) continue;
    let fm;
    try {
      fm = YAML.parse(m[1]);
    } catch {
      continue;
    }
    if (fm?.status !== 'in_progress') continue;
    if (!Array.isArray(fm.write_scope)) continue;
    result.push({ id: fm.id ?? f.replace(/\.md$/, ''), write_scope: fm.write_scope });
  }
  return result;
}

// ---------- CLI parsing ----------

function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean' },
      'read-only': { type: 'boolean' },
      write: { type: 'boolean' },
      fresh: { type: 'boolean' },
      resume: { type: 'boolean' },
      model: { type: 'string' },
      timeout: { type: 'string', default: '300' },
      'blackboard-dir': { type: 'string' },
      prompt: { type: 'string' },
      'write-scope': { type: 'string', multiple: true, default: [] },
    },
  });
  return values;
}

// ---------- main ----------

async function main() {
  const sub = process.argv[2];
  if (sub !== 'task') {
    console.error(`unknown subcommand: ${sub}`);
    process.exit(2);
  }
  const opts = parseCli(process.argv.slice(3));
  if (!opts.prompt) {
    console.error('--prompt is required');
    process.exit(2);
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const blackboard = opts['blackboard-dir'] ?? '.teamagent';
  const runsDir = join(blackboard, 'runs');
  const prompt = opts.prompt;

  // Write-scope overlap check (before any audit write — fail fast).
  if (opts['write-scope'].length > 0) {
    const open = openTicketScopes(blackboard);
    for (const { id, write_scope } of open) {
      for (const mine of opts['write-scope']) {
        if (globMatchAny(mine, write_scope)) {
          console.error(
            `write_scope overlap: "${mine}" conflicts with ticket ${id} (scope ${JSON.stringify(
              write_scope
            )})`
          );
          process.exit(3);
        }
      }
    }
  }

  const args = buildGeminiArgs({
    prompt,
    write: !!opts.write && !opts['read-only'],
    readOnly: !!opts['read-only'],
    model: opts.model,
    fresh: opts.fresh,
    resume: opts.resume,
  });

  writeSidecar(runsDir, runId, 'prompt', prompt);
  writeAuditEvent(runsDir, runId, {
    event: 'invoke',
    cli: 'gemini',
    argv: args,
    prompt_ref: `${runId}.prompt`,
    prompt_sha: sha256(prompt),
    write_scope: opts['write-scope'],
  });

  if (opts['dry-run']) {
    console.log(`argv: gemini ${args.join(' ')}`);
    writeAuditEvent(runsDir, runId, { event: 'dry_run' });
    process.exit(0);
  }

  const timeoutMs = Number(opts.timeout) * 1000;
  const r = await spawnWithTimeout('gemini', args, { timeoutMs });
  writeSidecar(runsDir, runId, 'stdout', r.stdout);
  writeSidecar(runsDir, runId, 'stderr', r.stderr);
  const kind = classifyGeminiError({
    exitCode: r.exitCode,
    stderr: r.stderr,
    timedOut: r.timedOut,
  });
  writeAuditEvent(runsDir, runId, {
    event: 'result',
    kind,
    exit_code: r.exitCode,
    stdout_bytes: Buffer.byteLength(r.stdout),
    stderr_bytes: Buffer.byteLength(r.stderr),
    elapsed_ms: r.elapsedMs,
    timed_out: r.timedOut,
  });

  // Emit stdout (possibly truncated) verbatim to the caller.
  process.stdout.write(truncateBytes(r.stdout, 64 * 1024));
  if (kind !== 'ok') process.stderr.write(r.stderr);
  process.exit(r.exitCode ?? 1);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
