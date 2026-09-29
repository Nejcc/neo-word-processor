const test = require('node:test');
const assert = require('node:assert/strict');
const NeoCore = require('../neo-core.js');

test('libName passes every name NEO makes and hand-named folders', () => {
  for (const name of ['book-my-great-book-mujlu771-5iwlx', 'ch-mujlu771-5iwl', 'notes', 'stickies', 'My Novel (draft)']) {
    assert.equal(NeoCore.libName(name), name);
  }
});

test('libName refuses anything that could leave the library', () => {
  for (const name of ['', '.', '..', '../book-x', 'a/b', 'a\\b', 'a\0b', null, undefined, 42]) {
    assert.throws(() => NeoCore.libName(name), /Invalid library name/);
  }
});
