import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  spawnWithTimeout,
  truncateBytes,
  writeAuditEvent,
  writeSidecar,
  sha256,
} from '../scripts/lib/common.mjs';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('spawnWithTimeout: captures stdout from node -e', async () => {
  const r = await spawnWithTimeout(
    'node',
    ['-e', 'process.stdout.write("hello")'],
    { timeoutMs: 5000 }
  );
  assert.equal(r.exitCode, 0);
  assert.equal(r.stdout, 'hello');
  assert.equal(r.timedOut, false);
});

test('spawnWithTimeout: captures stderr', async () => {
  const r = await spawnWithTimeout(
    'node',
    ['-e', 'process.stderr.write("err")'],
    { timeoutMs: 5000 }
  );
  assert.equal(r.stderr, 'err');
});

test('spawnWithTimeout: times out and tree-kills', async () => {
  const r = await spawnWithTimeout(
    'node',
    ['-e', 'setInterval(()=>{}, 1000)'],
    { timeoutMs: 200 }
  );
  assert.equal(r.timedOut, true);
  assert.notEqual(r.exitCode, 0);
});

test('spawnWithTimeout: passes stdin when provided', async () => {
  const r = await spawnWithTimeout(
    'node',
    ['-e', 'process.stdin.pipe(process.stdout)'],
    { timeoutMs: 5000, stdin: 'piped-input' }
  );
  assert.equal(r.stdout, 'piped-input');
});

test('truncateBytes: under limit returns as-is', () => {
  assert.equal(truncateBytes('hello', 100), 'hello');
});

test('truncateBytes: over limit truncates and marks', () => {
  const input = 'a'.repeat(200);
  const out = truncateBytes(input, 50);
  assert.ok(out.length <= 100); // truncated body + marker
  assert.match(out, /\[truncated \d+ bytes\]/);
});

test('sha256: deterministic and distinct', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(sha256('abc'), sha256('abd'));
  assert.equal(sha256('abc').length, 64);
});

test('spawnWithTimeout: ENOENT -> spawnError, no throw', async () => {
  const r = await spawnWithTimeout('this-binary-does-not-exist-xyz123', [], { timeoutMs: 5000 });
  // Either spawnError set (Unix) or non-zero exit from shell (Windows)
  if (r.spawnError !== undefined) {
    assert.match(r.spawnError, /ENOENT|not found|not recognized|Command failed/i);
  } else {
    assert.notEqual(r.exitCode, 0);
  }
  assert.equal(r.timedOut, false);
});

test('spawnWithTimeout: stdin closed by default so programs reading stdin do not hang', async () => {
  // Program reads stdin until EOF and exits; without EOF it would hang until timeoutMs.
  const start = Date.now();
  const r = await spawnWithTimeout(
    'node',
    ['-e', 'let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>process.stdout.write(s||"EMPTY"))'],
    { timeoutMs: 5000 }
  );
  assert.equal(r.timedOut, false);
  assert.ok(Date.now() - start < 2000, 'must finish well under timeout');
  assert.equal(r.stdout, 'EMPTY');
});

test('truncateBytes: preserves UTF-8 boundary (no U+FFFD)', () => {
  // 한 (3 bytes in UTF-8) repeated
  const input = '한'.repeat(10); // 30 bytes
  const out = truncateBytes(input, 10); // cut mid-character at byte 10
  const body = out.split('\n[truncated')[0];
  assert.ok(!body.includes('�'), 'body must not contain replacement char');
  // Body length in bytes must be <= maxBytes
  assert.ok(Buffer.byteLength(body, 'utf8') <= 10);
});

test('writeSidecar + writeAuditEvent: round-trip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tta-'));
  const runId = '2026-04-24-001';
  writeSidecar(dir, runId, 'prompt', 'the full prompt');
  writeAuditEvent(dir, runId, {
    event: 'invoke',
    cli: 'gemini',
    prompt_ref: `${runId}.prompt`,
  });

  const prompt = readFileSync(join(dir, `${runId}.prompt`), 'utf8');
  assert.equal(prompt, 'the full prompt');

  const jsonl = readFileSync(join(dir, `${runId}.jsonl`), 'utf8');
  const line = JSON.parse(jsonl.trim().split('\n')[0]);
  assert.equal(line.event, 'invoke');
  assert.equal(line.cli, 'gemini');
  assert.ok(line.ts);
});
