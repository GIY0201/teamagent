import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiArgs, classifyGeminiError } from '../scripts/lib/gemini.mjs';

test('buildGeminiArgs: minimal prompt -> positional -p', () => {
  const args = buildGeminiArgs({ prompt: 'hi', write: false, readOnly: true });
  assert.deepEqual(args, ['-p', 'hi']);
});

test('buildGeminiArgs: with model', () => {
  const args = buildGeminiArgs({ prompt: 'hi', model: 'gemini-2.5-pro', readOnly: true });
  assert.ok(args.includes('--model'));
  assert.ok(args.includes('gemini-2.5-pro'));
});

test('buildGeminiArgs: write enables yolo', () => {
  const args = buildGeminiArgs({ prompt: 'do it', write: true });
  assert.ok(args.includes('--yolo'));
});

test('buildGeminiArgs: read-only omits yolo', () => {
  const args = buildGeminiArgs({ prompt: 'read', write: false, readOnly: true });
  assert.ok(!args.includes('--yolo'));
});

test('buildGeminiArgs: fresh and resume are mutually exclusive (throws)', () => {
  assert.throws(
    () => buildGeminiArgs({ prompt: 'x', fresh: true, resume: true }),
    /mutually exclusive/
  );
});

test('classifyGeminiError: non-zero + auth stderr -> auth', () => {
  const kind = classifyGeminiError({
    exitCode: 1,
    stderr: 'Error: not authenticated. Run `gemini auth login`.',
  });
  assert.equal(kind, 'auth');
});

test('classifyGeminiError: exit 127 -> install', () => {
  const kind = classifyGeminiError({ exitCode: 127, stderr: '' });
  assert.equal(kind, 'install');
});

test('classifyGeminiError: exit 0 -> ok', () => {
  const kind = classifyGeminiError({ exitCode: 0, stderr: '' });
  assert.equal(kind, 'ok');
});

test('classifyGeminiError: timeout -> timeout', () => {
  const kind = classifyGeminiError({ exitCode: null, stderr: '', timedOut: true });
  assert.equal(kind, 'timeout');
});
