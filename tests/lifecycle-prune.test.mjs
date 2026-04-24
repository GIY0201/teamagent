import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prune } from '../hooks/lifecycle-prune.mjs';
import { mkdtempSync, writeFileSync, existsSync, utimesSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function ageFile(path, daysAgo) {
  const t = (Date.now() - daysAgo * 86400 * 1000) / 1000;
  utimesSync(path, t, t);
}

test('prune: drops sidecars older than threshold, keeps jsonl', () => {
  const bb = mkdtempSync(join(tmpdir(), 'tta-pr-'));
  const runs = join(bb, 'runs');
  mkdirSync(runs, { recursive: true });

  writeFileSync(join(runs, 'old.jsonl'), '{"ts":"x"}\n');
  writeFileSync(join(runs, 'old.stdout'), 'big');
  writeFileSync(join(runs, 'old.prompt'), 'big');
  writeFileSync(join(runs, 'recent.jsonl'), '{"ts":"y"}\n');
  writeFileSync(join(runs, 'recent.stdout'), 'fresh');

  ageFile(join(runs, 'old.jsonl'), 45);
  ageFile(join(runs, 'old.stdout'), 45);
  ageFile(join(runs, 'old.prompt'), 45);
  ageFile(join(runs, 'recent.jsonl'), 2);
  ageFile(join(runs, 'recent.stdout'), 2);

  const stats = prune(bb, 30);

  assert.equal(stats.droppedSidecars, 2); // old.stdout + old.prompt
  assert.equal(existsSync(join(runs, 'old.jsonl')), true); // jsonl kept
  assert.equal(existsSync(join(runs, 'old.stdout')), false);
  assert.equal(existsSync(join(runs, 'recent.stdout')), true);
});

test('prune: no runs dir is a no-op', () => {
  const bb = mkdtempSync(join(tmpdir(), 'tta-pr-empty-'));
  const stats = prune(bb, 30);
  assert.equal(stats.droppedSidecars, 0);
});
