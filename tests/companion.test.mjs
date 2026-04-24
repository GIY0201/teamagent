import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnWithTimeout } from '../scripts/lib/common.mjs';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const COMPANION = 'scripts/gemini-companion.mjs';

test('gemini-companion: task with --dry-run prints argv and exits 0', async () => {
  const r = await spawnWithTimeout(
    'node',
    [COMPANION, 'task', '--dry-run', '--read-only', '--prompt', 'scan for X'],
    { timeoutMs: 10000 }
  );
  assert.equal(r.exitCode, 0, r.stderr);
  assert.match(r.stdout, /argv:/);
  assert.match(r.stdout, /scan for X/);
});

test('gemini-companion: writes audit + sidecars on dry-run', async () => {
  const bb = mkdtempSync(join(tmpdir(), 'tta-bb-'));
  const r = await spawnWithTimeout(
    'node',
    [
      COMPANION,
      'task',
      '--dry-run',
      '--read-only',
      '--blackboard-dir',
      bb,
      '--prompt',
      'summarize this doc',
    ],
    { timeoutMs: 10000 }
  );
  assert.equal(r.exitCode, 0, r.stderr);

  const runsDir = join(bb, 'runs');
  const entries = readdirSync(runsDir);
  const promptFile = entries.find((f) => f.endsWith('.prompt'));
  assert.ok(promptFile, 'prompt sidecar missing');
  const prompt = readFileSync(join(runsDir, promptFile), 'utf8');
  assert.equal(prompt, 'summarize this doc');
  const jsonl = entries.find((f) => f.endsWith('.jsonl'));
  assert.ok(jsonl, 'audit JSONL missing');
});

test('gemini-companion: refuses when write-scope overlaps open ticket', async () => {
  const bb = mkdtempSync(join(tmpdir(), 'tta-wc-'));
  mkdirSync(join(bb, 'tickets'), { recursive: true });
  writeFileSync(
    join(bb, 'tickets', '2026-04-24-001.md'),
    `---
id: 2026-04-24-001
status: in_progress
owner: claude
write_scope: ["src/auth/**"]
---
## Plan
`
  );

  const r = await spawnWithTimeout(
    'node',
    [
      COMPANION,
      'task',
      '--dry-run',
      '--blackboard-dir',
      bb,
      '--write',
      '--write-scope',
      'src/auth/oauth.js',
      '--prompt',
      'edit oauth',
    ],
    { timeoutMs: 10000 }
  );
  assert.notEqual(r.exitCode, 0, 'should reject overlap');
  assert.match(r.stderr, /write_scope overlap/);
});

test('gemini-companion: allows disjoint write-scope', async () => {
  const bb = mkdtempSync(join(tmpdir(), 'tta-wc-ok-'));
  mkdirSync(join(bb, 'tickets'), { recursive: true });
  writeFileSync(
    join(bb, 'tickets', '2026-04-24-002.md'),
    `---
id: 2026-04-24-002
status: in_progress
owner: claude
write_scope: ["src/ui/**"]
---
`
  );

  const r = await spawnWithTimeout(
    'node',
    [
      COMPANION,
      'task',
      '--dry-run',
      '--blackboard-dir',
      bb,
      '--write',
      '--write-scope',
      'src/auth/oauth.js',
      '--prompt',
      'ok',
    ],
    { timeoutMs: 10000 }
  );
  assert.equal(r.exitCode, 0, r.stderr);
});
