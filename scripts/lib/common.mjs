// scripts/lib/common.mjs
// Low-level helpers: subprocess with timeout + tree-kill, truncation, audit writers.

// cross-spawn handles Windows .cmd/.bat shim resolution without shell:true
// (which would break arg quoting on spaces). Argument quoting is identical to node's spawn.
import spawn from 'cross-spawn';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import treeKill from 'tree-kill';

/**
 * Spawn a subprocess, capture stdout/stderr, enforce timeout, tree-kill on timeout.
 *
 * Fixes applied after Codex review:
 *   - stdin EOF always sent (unless caller keeps stdin open via `keepStdinOpen: true`);
 *     CLIs like `gemini -p` hang forever without EOF.
 *   - spawn `error` event handled (ENOENT, invalid cwd) → resolves with `spawnError`.
 *   - Windows: use `shell: true` so `.cmd`/`.bat` shims (gemini, codex installed via npm) resolve.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {{
 *   timeoutMs: number,
 *   stdin?: string,
 *   keepStdinOpen?: boolean,
 *   cwd?: string,
 *   env?: NodeJS.ProcessEnv
 * }} opts
 * @returns {Promise<{
 *   exitCode: number|null,
 *   stdout: string,
 *   stderr: string,
 *   timedOut: boolean,
 *   elapsedMs: number,
 *   spawnError?: string
 * }>}
 */
export async function spawnWithTimeout(cmd, args, opts) {
  const start = Date.now();
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  let spawnError;

  // Handle spawn-time errors (ENOENT, bad cwd, EACCES) so we never throw
  // unhandled and so callers get a structured result.
  child.on('error', (err) => {
    spawnError = err.message;
  });

  child.stdout?.on('data', (d) => {
    stdout += d.toString('utf8');
  });
  child.stderr?.on('data', (d) => {
    stderr += d.toString('utf8');
  });

  // Always close stdin unless caller explicitly keeps it open.
  // Without this, child processes that read stdin hang until timeout.
  if (child.stdin) {
    if (opts.stdin !== undefined) child.stdin.write(opts.stdin);
    if (!opts.keepStdinOpen) child.stdin.end();
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid) treeKill(child.pid, 'SIGKILL');
  }, opts.timeoutMs);

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
    // If spawn failed, 'close' may still fire (with null code); fallback after 50ms.
    child.on('error', () => setTimeout(() => resolve(null), 50));
  });
  clearTimeout(timer);

  return {
    exitCode,
    stdout,
    stderr,
    timedOut,
    elapsedMs: Date.now() - start,
    ...(spawnError ? { spawnError } : {}),
  };
}

/**
 * Truncate a utf8 string to at most `maxBytes` body bytes, preserving UTF-8 character
 * boundaries (no U+FFFD artifacts from mid-codepoint cuts). Appends a marker line.
 */
export function truncateBytes(s, maxBytes) {
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return s;
  // Walk back from maxBytes until we're at a UTF-8 codepoint start.
  // Continuation bytes have the bit pattern 10xxxxxx (0x80..0xBF).
  let cut = maxBytes;
  while (cut > 0 && (buf[cut] & 0xc0) === 0x80) cut--;
  const body = buf.subarray(0, cut).toString('utf8');
  const dropped = buf.length - cut;
  return body + `\n[truncated ${dropped} bytes]`;
}

/** sha256 hex digest (utf8). */
export function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Write a sidecar file next to a run id (prompt, memory, stdout, stderr).
 * @param {string} dir  directory (usually `.teamagent/runs/`)
 * @param {string} runId
 * @param {'prompt'|'memory'|'stdout'|'stderr'} kind
 * @param {string} content
 */
export function writeSidecar(dir, runId, kind, content) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${runId}.${kind}`), content, 'utf8');
}

/** Append one JSONL audit event with an auto-timestamp. */
export function writeAuditEvent(dir, runId, event) {
  mkdirSync(dir, { recursive: true });
  const row = { ts: new Date().toISOString(), ...event };
  appendFileSync(join(dir, `${runId}.jsonl`), JSON.stringify(row) + '\n', 'utf8');
}
