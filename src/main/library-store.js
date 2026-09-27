const fs = require('fs');
const path = require('path');
const NeoCore = require('../../neo-core.js');

function createLibraryStore({ libraryDir, onError } = {}) {
  let root = libraryDir;
  const report = (source, err) => {
    if (typeof onError === 'function') onError(source, err);
  };

  function setLibraryDir(next) {
    root = next;
  }

  function libraryDirPath() {
    return root;
  }

  function libraryFile() {
    return path.join(root, 'library.json');
  }

  function bookDir(bookId) {
    return path.join(root, NeoCore.files.bookDir(bookId));
  }

  function chapterFile(bookId, chapterId) {
    return path.join(bookDir(bookId), 'chapters', NeoCore.files.chapterHtml(chapterId));
  }

  function auxFile(bookId, name) {
    return path.join(bookDir(bookId), NeoCore.files.auxHtml(name));
  }

  function jsonSidecarFile(bookId, name) {
    return path.join(bookDir(bookId), NeoCore.files.jsonSidecar(name));
  }

  function readJSON(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  function writeJSON(file, data) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }

  function ensureLibrary() {
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    if (!fs.existsSync(libraryFile())) {
      fs.writeFileSync(libraryFile(), JSON.stringify(NeoCore.defaultLibrary(), null, 2));
    }
  }

  // The catalog is a human-facing index, not app state. Regenerate it after
  // shelf/meta changes so browsing the plain library folder stays friendly.
  function writeCatalog() {
    try {
      const lib = readJSON(libraryFile(), { shelves: [] });
      const onShelf = {};
      for (const s of lib.shelves || []) {
        for (const id of s.bookIds) onShelf[id] = s.name;
      }
      const lines = [];
      for (const d of fs.readdirSync(root)) {
        if (!d.startsWith('book-')) continue;
        try {
          const m = JSON.parse(fs.readFileSync(path.join(root, d, 'book.json'), 'utf8'));
          lines.push(`${m.title || 'Untitled'}  —  ${d}  —  shelf: ${onShelf[m.id] || '(none — removed from shelves)'}`);
        } catch { /* not a valid book folder */ }
      }
      lines.sort((a, b) => a.localeCompare(b));
      fs.writeFileSync(path.join(root, '_catalog.txt'),
        'NEO LIBRARY CATALOG — which folder is which book\n' +
        '(regenerated automatically; edits here do nothing)\n\n' +
        lines.join('\n') + '\n');
    } catch (err) {
      report('catalog', err);
    }
  }

  function readLibrary() {
    ensureLibrary();
    return readJSON(libraryFile(), null);
  }

  function writeLibrary(data) {
    ensureLibrary();
    writeJSON(libraryFile(), data);
    writeCatalog();
    return true;
  }

  function createBook(meta) {
    ensureLibrary();
    const book = NeoCore.defaultBook({ ...(meta || {}), id: undefined });
    const dir = bookDir(book.id);
    fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
    writeJSON(path.join(dir, 'book.json'), book);
    fs.writeFileSync(path.join(dir, 'notes.html'), '');
    fs.writeFileSync(path.join(dir, 'outline.html'), '');
    writeJSON(path.join(dir, 'darlings.json'), []);
    writeJSON(path.join(dir, 'stickies.json'), []);
    return book;
  }

  function listBooks() {
    const out = [];
    try {
      for (const d of fs.readdirSync(root)) {
        if (!NeoCore.validators.bookId(d)) continue;
        const m = readJSON(path.join(root, d, 'book.json'), null);
        if (m && m.id) out.push({ id: m.id, title: m.title || 'Untitled', author: m.author || '', modified: m.modified || '' });
      }
    } catch (err) {
      report('listBooks', err);
    }
    return out;
  }

  function readBookMeta(bookId) {
    return readJSON(path.join(bookDir(bookId), 'book.json'), null);
  }

  function writeBookMeta(bookId, meta) {
    NeoCore.files.bookDir(bookId);
    if (!meta || meta.id !== bookId) throw new Error('Book metadata id mismatch');
    meta.modified = new Date().toISOString();
    writeJSON(path.join(bookDir(bookId), 'book.json'), meta);
    writeCatalog();
    return true;
  }

  function readChapter(bookId, chapterId) {
    try {
      return fs.readFileSync(chapterFile(bookId, chapterId), 'utf8');
    } catch {
      return '';
    }
  }

  function writeChapter(bookId, chapterId, html) {
    const dir = path.join(bookDir(bookId), 'chapters');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, NeoCore.files.chapterHtml(chapterId)), html);
    return true;
  }

  function deleteChapter(bookId, chapterId) {
    const file = chapterFile(bookId, chapterId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  }

  function readAux(bookId, name) {
    try {
      return fs.readFileSync(auxFile(bookId, name), 'utf8');
    } catch {
      return '';
    }
  }

  function writeAux(bookId, name, html) {
    fs.writeFileSync(auxFile(bookId, name), html);
    return true;
  }

  function readSidecar(bookId, name, fallback) {
    return readJSON(jsonSidecarFile(bookId, name), fallback);
  }

  function writeSidecar(bookId, name, data) {
    writeJSON(jsonSidecarFile(bookId, name), data);
    return true;
  }

  return {
    setLibraryDir,
    libraryDirPath,
    libraryFile,
    bookDir,
    readJSON,
    writeJSON,
    ensureLibrary,
    writeCatalog,
    readLibrary,
    writeLibrary,
    createBook,
    listBooks,
    readBookMeta,
    writeBookMeta,
    readChapter,
    writeChapter,
    deleteChapter,
    readAux,
    writeAux,
    readSidecar,
    writeSidecar
  };
}

module.exports = { createLibraryStore };
