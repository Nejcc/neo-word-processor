'use strict';

// Usage: node scripts/check-romanian-package.js <packaged Resources directory>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');

const resources = process.argv[2];
if (!resources) throw new Error('Pass the packaged Resources directory');
const root = path.join(__dirname, '..');
const dictionary = path.join(resources, 'app.asar.unpacked/node_modules/dictionary-ro');
for (const file of ['index.aff', 'index.dic', 'license']) {
  assert.deepEqual(fs.readFileSync(path.join(dictionary, file)),
    fs.readFileSync(path.join(root, 'node_modules/dictionary-ro', file)), file);
}
for (const file of ['NOTICE.txt', 'MPL-1.1.txt', 'upstream-license.txt']) {
  assert.deepEqual(fs.readFileSync(path.join(dictionary, file)),
    fs.readFileSync(path.join(root, 'licenses/dictionary-ro', file)), file);
}
for (const file of ['spell-worker.js', 'spell-ro.js']) {
  assert.deepEqual(asar.extractFile(path.join(resources, 'app.asar'), file),
    fs.readFileSync(path.join(root, file)), file);
}
console.log('Romanian dictionary source, license notices and worker code verified.');
