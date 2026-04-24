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
