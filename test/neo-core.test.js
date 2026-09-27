const test = require('node:test');
const assert = require('node:assert/strict');
const NeoCore = require('../neo-core.js');

test('default library keeps the stable first shelf contract', () => {
  const library = NeoCore.defaultLibrary();

  assert.equal(library.pageTheme, 'night');
  assert.deepEqual(library.shelves, [{
    id: 'shelf-1',
    name: NeoCore.DEFAULT_SHELF_NAME,
    bookIds: []
  }]);
});

test('default book mints a safe readable id from the title', () => {
  const book = NeoCore.defaultBook({ title: '../../My Great Book!!', author: 'Neo' });

  assert.match(book.id, /^book-my-great-book-[a-z0-9]+-[a-z0-9]+$/);
  assert.equal(book.title, '../../My Great Book!!');
  assert.equal(book.author, 'Neo');
  assert.deepEqual(book.tabNames, NeoCore.DEFAULT_TAB_NAMES);
});

test('validators accept NEO paths and reject traversal-shaped input', () => {
  assert.equal(NeoCore.validators.bookId('book-my-great-book-mujlu771-5iwlx'), true);
  assert.equal(NeoCore.validators.bookId('../book-my-great-book'), false);
  assert.equal(NeoCore.validators.chapterId(NeoCore.id.chapter()), true);
  assert.equal(NeoCore.validators.chapterId('../ch-bad'), false);
  assert.equal(NeoCore.validators.auxName('notes'), true);
  assert.equal(NeoCore.validators.auxName('notes/evil'), false);
  assert.equal(NeoCore.validators.jsonSidecar('stickies'), true);
  assert.equal(NeoCore.validators.jsonSidecar('art'), false);
  assert.equal(NeoCore.validators.coverFile('cover-123.jpg'), true);
  assert.equal(NeoCore.validators.coverFile('../cover-123.jpg'), false);
  assert.equal(NeoCore.validators.coverExt('jpeg'), true);
  assert.equal(NeoCore.validators.coverExt('svg'), false);
});

test('file helpers validate before returning disk-facing names', () => {
  assert.equal(NeoCore.files.bookDir('book-my-great-book-mujlu771-5iwlx'), 'book-my-great-book-mujlu771-5iwlx');
  assert.equal(NeoCore.files.chapterHtml('ch-mujlu771-5iwl'), 'ch-mujlu771-5iwl.html');
  assert.equal(NeoCore.files.auxHtml('notes'), 'notes.html');
  assert.equal(NeoCore.files.jsonSidecar('stickies'), 'stickies.json');
  assert.equal(NeoCore.files.cover('cover-123.webp'), 'cover-123.webp');

  assert.throws(() => NeoCore.files.bookDir('../book-my-great-book'), /Invalid bookId/);
  assert.throws(() => NeoCore.files.chapterHtml('../ch-bad'), /Invalid chapterId/);
  assert.throws(() => NeoCore.files.auxHtml('notes/evil'), /Invalid aux name/);
  assert.throws(() => NeoCore.files.jsonSidecar('art'), /Invalid JSON sidecar/);
  assert.throws(() => NeoCore.files.cover('../cover-123.jpg'), /Invalid cover file/);
});
