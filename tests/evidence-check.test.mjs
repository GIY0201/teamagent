import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTicketCompletion } from '../hooks/evidence-check.mjs';

const good = `---
id: 2026-04-24-001
status: done
acceptance_criteria:
  - "Tests pass"
  - "Lint clean"
---

## Evidence

Acceptance criterion "Tests pass":
\`\`\`bash
$ npm test
# tests 8, # pass 8, # fail 0
\`\`\`

Acceptance criterion "Lint clean":
\`\`\`diff
- no diff; lint output follows
\`\`\`
`;

test('validateTicketCompletion: well-formed passes', () => {
  const r = validateTicketCompletion(good);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('validateTicketCompletion: empty Evidence fails', () => {
  const text = good.replace(/## Evidence[\s\S]*$/, '## Evidence\n\n');
  const r = validateTicketCompletion(text);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Evidence section is empty/i);
});

test('validateTicketCompletion: no structured block fails', () => {
  const text = `---
id: x
status: done
acceptance_criteria: ["c1"]
---
## Evidence

Acceptance criterion "c1": all good.
`;
  const r = validateTicketCompletion(text);
  assert.equal(r.ok, false);
  assert.match(r.reason, /structured block/i);
});

test('validateTicketCompletion: missing criterion reference fails', () => {
  const text = `---
id: x
status: done
acceptance_criteria: ["criterion-A", "criterion-B"]
---
## Evidence

Acceptance criterion "criterion-A":
\`\`\`diff
+ implemented
\`\`\`
`;
  const r = validateTicketCompletion(text);
  assert.equal(r.ok, false);
  assert.match(r.reason, /criterion-B/);
});

test('validateTicketCompletion: not setting status=done returns ok=true', () => {
  const text = good.replace('status: done', 'status: in_progress');
  const r = validateTicketCompletion(text);
  assert.equal(r.ok, true);
});

test('validateTicketCompletion: CRLF line endings still validate (Windows files)', () => {
  const crlf = good.replace(/\n/g, '\r\n');
  const r = validateTicketCompletion(crlf);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('validateTicketCompletion: UTF-8 BOM stripped (Windows editors)', () => {
  const bom = '﻿' + good;
  const r = validateTicketCompletion(bom);
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('validateTicketCompletion: acceptance_criteria as string (not array) fails', () => {
  const text = good.replace(
    'acceptance_criteria:\n  - "Tests pass"\n  - "Lint clean"',
    'acceptance_criteria: "Tests pass, Lint clean"'
  );
  const r = validateTicketCompletion(text);
  assert.equal(r.ok, false);
  assert.match(r.reason, /array/i);
});
