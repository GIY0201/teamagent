// scripts/lib/common.mjs
// Low-level helpers: subprocess with timeout + tree-kill, truncation, audit writers.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import treeKill from 'tree-kill';

/**
 * Spawn a subprocess, capture stdout/stderr, enforce timeout, tree-kill on timeout.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{timeoutMs: number, stdin?: string, cwd?: string, env?: NodeJS.ProcessEnv}} opts
 * @returns {Promise<{exitCode: number|null, stdout: string, stderr: string, timedOut: boolean, elapsedMs: number}>}
 */
export async function spawnWithTimeout(cmd, args, opts) {
  const start = Date.now();
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString('utf8');
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString('utf8');
  });

  if (opts.stdin !== undefined) {
    child.stdin.write(opts.stdin);
    child.stdin.end();
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (child.pid) treeKill(child.pid, 'SIGKILL');
  }, opts.timeoutMs);

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code));
  });
  clearTimeout(timer);

  return {
    exitCode,
    stdout,
    stderr,
    timedOut,
    elapsedMs: Date.now() - start,
  };
}

/** Truncate a utf8 string to at most maxBytes and append a marker. */
export function truncateBytes(s, maxBytes) {
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return s;
  const dropped = buf.length - maxBytes;
  return buf.subarray(0, maxBytes).toString('utf8') + `\n[truncated ${dropped} bytes]`;
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
