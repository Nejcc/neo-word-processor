'use strict';

// Fresh processes, warm filesystem cache. Run with:
// node scripts/benchmark-spellcheck.js
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const variant = process.argv[2];
if (!variant) {
  for (let trial = 1; trial <= 3; trial++) {
    for (const name of ['en-US', 'ro-raw', 'ro']) {
      const child = spawnSync(process.execPath, ['--expose-gc', __filename, name], {
        encoding: 'utf8', timeout: 60000
      });
      if (child.status !== 0) throw new Error(child.stderr || String(child.error || 'benchmark failed'));
      console.log(JSON.stringify({ trial, ...JSON.parse(child.stdout) }));
    }
  }
} else {
  const nspell = require('nspell');
  const { prepareRomanianDictionary } = require('../spell-ro');
  const pkg = variant === 'en-US' ? 'dictionary-en-us' : 'dictionary-ro';
  const dir = path.join(__dirname, '..', 'node_modules', pkg);
  global.gc();
  const before = process.memoryUsage();
  const start = performance.now();
  let dict = { aff: fs.readFileSync(path.join(dir, 'index.aff')), dic: fs.readFileSync(path.join(dir, 'index.dic')) };
  if (variant === 'ro') dict = prepareRomanianDictionary(dict);
  const spell = nspell(dict);
  const loadMs = performance.now() - start;
  dict = null;
  global.gc();
  const after = process.memoryUsage();
  const typo = variant === 'en-US' ? 'sentnce' : 'frgament';
  const suggestStart = performance.now();
  const suggestions = spell.suggest(typo).slice(0, 6);
  console.log(JSON.stringify({
    variant, node: process.version, arch: process.arch, loadMs,
    retainedHeapMiB: (after.heapUsed - before.heapUsed) / 1048576,
    rssDeltaMiB: (after.rss - before.rss) / 1048576,
    maxRssMiB: process.resourceUsage().maxRSS / 1024,
    sampleCorrect: spell.correct(variant === 'en-US' ? 'sentence' : 'trebui'),
    suggestMs: performance.now() - suggestStart, suggestions
  }));
}
