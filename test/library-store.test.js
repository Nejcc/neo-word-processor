const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLibraryStore } = require('../src/main/library-store.js');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-library-store-'));
  return { dir, store: createLibraryStore({ libraryDir: dir }) };
}

test('library store creates the default library and book files', () => {
  const { dir, store } = tempStore();
  try {
    const library = store.readLibrary();
    assert.equal(library.pageTheme, 'night');
    assert.equal(fs.existsSync(path.join(dir, 'library.json')), true);

    const book = store.createBook({ title: 'Store Test', author: 'Neo' });
    assert.match(book.id, /^book-store-test-/);
    assert.equal(fs.existsSync(path.join(dir, book.id, 'book.json')), true);
    assert.equal(fs.existsSync(path.join(dir, book.id, 'chapters')), true);
    assert.equal(store.readBookMeta(book.id).title, 'Store Test');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('library store reads and writes chapters, aux files, and sidecars', () => {
  const { dir, store } = tempStore();
  try {
    const book = store.createBook({ title: 'Sidecars' });
    const chapterId = 'ch-test-1234';

    assert.equal(store.writeChapter(book.id, chapterId, '<p>Hello</p>'), true);
    assert.equal(store.readChapter(book.id, chapterId), '<p>Hello</p>');

    assert.equal(store.writeAux(book.id, 'notes', '<p>Note</p>'), true);
    assert.equal(store.readAux(book.id, 'notes'), '<p>Note</p>');

    assert.equal(store.writeSidecar(book.id, 'stickies', [{ id: 's-1' }]), true);
    assert.deepEqual(store.readSidecar(book.id, 'stickies', []), [{ id: 's-1' }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('library store updates catalog and rejects path-shaped names', () => {
  const { dir, store } = tempStore();
  try {
    const book = store.createBook({ title: 'Catalog Test' });
    const library = store.readLibrary();
    library.shelves[0].bookIds.push(book.id);
    store.writeLibrary(library);

    const catalog = fs.readFileSync(path.join(dir, '_catalog.txt'), 'utf8');
    assert.match(catalog, /Catalog Test/);
    assert.match(catalog, /Works in Progress/);

    assert.throws(() => store.readBookMeta('../book-bad'), /Invalid bookId/);
    assert.throws(() => store.writeChapter(book.id, '../ch-bad', ''), /Invalid chapterId/);
    assert.throws(() => store.writeAux(book.id, 'notes/evil', ''), /Invalid aux name/);
    assert.throws(() => store.writeSidecar(book.id, 'art', {}), /Invalid JSON sidecar/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
