// Integration smoke tests — require real CLIs to be installed + authenticated.
// Run: TEAMAGENT_INTEGRATION=1 npm run test:integration
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnWithTimeout } from '../../scripts/lib/common.mjs';

const RUN = process.env.TEAMAGENT_INTEGRATION === '1';
const SKIP_MSG = 'set TEAMAGENT_INTEGRATION=1 to run live CLI tests';

test(
  'live gemini: --dry-run reaches companion and writes audit',
  { skip: !RUN && SKIP_MSG },
  async () => {
    const r = await spawnWithTimeout(
      'node',
      ['scripts/gemini-companion.mjs', 'task', '--read-only', '--dry-run', '--prompt', 'PONG test'],
      { timeoutMs: 15000 }
    );
    assert.equal(r.exitCode, 0, r.stderr);
    assert.match(r.stdout, /argv:/);
  }
);

test(
  'live gemini: actual CLI invocation returns PONG',
  { skip: !RUN && SKIP_MSG },
  async () => {
    const r = await spawnWithTimeout(
      'node',
      [
        'scripts/gemini-companion.mjs',
        'task',
        '--read-only',
        '--prompt',
        'Respond with exactly the single word: PONG',
      ],
      { timeoutMs: 90000 }
    );
    assert.equal(r.exitCode, 0, r.stderr);
    assert.match(r.stdout, /PONG/i);
  }
);

test(
  'live codex: exec smoke test returns PONG',
  { skip: !RUN && SKIP_MSG },
  async () => {
    const r = await spawnWithTimeout(
      'codex',
      ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', 'Respond with exactly the single word: PONG'],
      { timeoutMs: 90000 }
    );
    assert.equal(r.exitCode, 0, r.stderr);
    assert.match(r.stdout, /PONG/i);
  }
);
