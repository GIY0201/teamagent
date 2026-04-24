// scripts/lib/gemini.mjs
// Translate teamagent-standard runtime flags into `gemini` CLI flags,
// plus coarse classification of spawn results.

/**
 * @typedef {object} GeminiOpts
 * @property {string} prompt
 * @property {boolean} [write]        // default: false (read-only)
 * @property {boolean} [readOnly]     // default: !write
 * @property {boolean} [fresh]
 * @property {boolean} [resume]
 * @property {string}  [model]
 * @property {string}  [effort]       // 'low'|'medium'|'high' — gemini has no direct knob yet
 */

/**
 * @param {GeminiOpts} opts
 * @returns {string[]} argv for the `gemini` binary (prompt passed positionally via -p)
 */
export function buildGeminiArgs(opts) {
  if (opts.fresh && opts.resume) {
    throw new Error('--fresh and --resume are mutually exclusive');
  }
  const args = [];
  if (opts.model) {
    args.push('--model', opts.model);
  }
  if (opts.write) {
    args.push('--yolo'); // skip interactive confirmations when writing
  }
  // effort: gemini CLI has no direct analogue yet; swallow with warning (caller logs).
  // resume/fresh: gemini CLI does not currently expose a --resume-last primitive;
  //   we pass through unchanged and rely on cwd stability.
  args.push('-p', opts.prompt);
  return args;
}

/**
 * Map spawn result to a coarse error kind so callers can produce good UX.
 * Primary signal: exit code. Secondary: stderr pattern.
 * @param {{exitCode: number|null, stderr: string, timedOut?: boolean}} r
 * @returns {'ok'|'auth'|'install'|'timeout'|'error'}
 */
export function classifyGeminiError(r) {
  if (r.timedOut) return 'timeout';
  if (r.exitCode === 0) return 'ok';
  if (r.exitCode === 127) return 'install';
  if (/ENOENT/.test(r.stderr)) return 'install';
  const stderr = r.stderr.toLowerCase();
  if (
    /not authenticated|auth(entication)? required|login required|please (run |authenticate|sign in)/.test(
      stderr
    )
  ) {
    return 'auth';
  }
  return 'error';
}
