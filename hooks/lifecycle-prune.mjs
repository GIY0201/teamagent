// hooks/lifecycle-prune.mjs
// SessionStart hook: drops sidecar bodies older than N days. Keeps JSONL metadata.

import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SIDECAR_EXTS = new Set(['.prompt', '.memory', '.stdout', '.stderr']);

/**
 * Prune sidecar files older than `retentionDays`. Returns stats.
 * @param {string} blackboardDir
 * @param {number} retentionDays
 */
export function prune(blackboardDir, retentionDays = 30) {
  const runs = join(blackboardDir, 'runs');
  if (!existsSync(runs)) return { droppedSidecars: 0 };
  const cutoff = Date.now() - retentionDays * 86400 * 1000;
  let dropped = 0;
  for (const f of readdirSync(runs)) {
    const ext = f.slice(f.lastIndexOf('.'));
    if (!SIDECAR_EXTS.has(ext)) continue;
    const full = join(runs, f);
    const st = statSync(full);
    if (st.mtimeMs < cutoff) {
      unlinkSync(full);
      dropped++;
    }
  }
  return { droppedSidecars: dropped };
}

// ---------- hook entry ----------
// pathToFileURL for Windows-safe comparison (Codex P0 fix).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bb = process.env.TEAMAGENT_BLACKBOARD_DIR ?? '.teamagent';
  try {
    const stats = prune(bb, 30);
    if (stats.droppedSidecars > 0) {
      process.stderr.write(`teamagent: pruned ${stats.droppedSidecars} old sidecars\n`);
    }
  } catch {
    /* fail silently — hook must never block SessionStart */
  }
  process.exit(0);
}
