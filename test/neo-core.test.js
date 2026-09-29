const test = require('node:test');
const assert = require('node:assert/strict');
const NeoCore = require('../neo-core.js');

test('libName passes every name NEO makes and hand-named folders', () => {
  for (const name of ['book-my-great-book-mujlu771-5iwlx', 'ch-mujlu771-5iwl', 'notes', 'stickies', 'My Novel (draft)', NeoCore.id.chapter()]) {
    assert.equal(NeoCore.libName(name), name);
  }
});

test('libName refuses anything that could leave the library', () => {
  for (const name of ['', '.', '..', '../book-x', 'a/b', 'a\\b', 'a\0b', null, undefined, 42]) {
    assert.throws(() => NeoCore.libName(name), /Invalid library name/);
  }
});

test('ids keep the shapes NEO has always written', () => {
  assert.match(NeoCore.id.chapter(), /^ch-[a-z0-9]+-[a-z0-9]{1,4}$/);
  assert.match(NeoCore.id.shelf(), /^shelf-[a-z0-9]+$/);
  assert.match(NeoCore.id.section(), /^sec-[a-z0-9]+$/);
  assert.notEqual(NeoCore.id.sticky(), NeoCore.id.sticky());
});
