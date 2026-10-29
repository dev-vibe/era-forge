#!/usr/bin/env node
// The `eraforge` command: `npx eraforge build|site|test|scene|run|path ...` (Eraforge, job fw-F5, 29 Oct 2026).
// The tools are Python (3.10 or newer, with Pillow, NumPy, OpenCV and Playwright for the ones that need them); this launcher only finds
// them and runs tools/eraforge.py. FW_PATH=<framework checkout> runs that checkout instead of this package (local co-development: try a
// framework change on a game before tagging it).
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const own = path.resolve(__dirname, '..');
const fw = process.env.FW_PATH ? path.resolve(process.env.FW_PATH) : own;
const entry = path.join(fw, 'tools', 'eraforge.py');
if (!fs.existsSync(entry)) {
  console.error(`eraforge: ${entry} not found` + (process.env.FW_PATH ? ' (FW_PATH must be a framework checkout)' : ''));
  process.exit(2);
}
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const r = spawnSync(python, [entry, ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } });
if (r.error) { console.error(`eraforge: could not run ${python}: ${r.error.message}`); process.exit(2); }
process.exit(r.status === null ? 1 : r.status);
