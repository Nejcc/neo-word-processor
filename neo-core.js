/* Shared NEO domain defaults, ID helpers, and validators.
   Keep this dependency-free: it loads in Electron main via require(),
   and in the desktop renderer/Pocket webviews as window.NeoCore. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.NeoCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_SHELF_NAME = 'Works in Progress';
  const DEFAULT_TAB_NAMES = Object.freeze({ notes: 'Notes', outline: 'Outline' });
  const AUX_HTML_NAMES = Object.freeze(['notes', 'outline']);
  const JSON_SIDECAR_NAMES = Object.freeze(['darlings', 'stickies']);
  const COVER_EXTS = Object.freeze(['png', 'jpg', 'jpeg', 'webp']);

  function slugify(value, max = 30) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max);
  }

  function randomPart(len) {
    return Math.random().toString(36).slice(2, 2 + len);
  }

  function makeId(prefix, opts = {}) {
    const seed = opts.seed ? slugify(opts.seed, opts.seedMax || 30) : '';
    const randomLen = opts.randomLen == null ? 5 : opts.randomLen;
    const random = randomLen > 0 ? '-' + randomPart(randomLen) : '';
    return prefix + '-' + (seed ? seed + '-' : '') + Date.now().toString(36) + random;
  }

  const id = Object.freeze({
    book: (title) => makeId('book', { seed: title, randomLen: 5 }),
    shelf: () => makeId('shelf', { randomLen: 0 }),
    author: () => makeId('a', { randomLen: 0 }),
    chapter: () => makeId('ch', { randomLen: 4 }),
    sticky: () => makeId('s', { randomLen: 4 }),
    darling: () => makeId('d', { randomLen: 4 }),
    section: () => makeId('sec', { randomLen: 0 })
  });

  function defaultLibrary() {
    return {
      authorName: '',
      penNames: [],
      firstRunDone: false,
      pageTheme: 'night',
      shelves: [{ id: 'shelf-1', name: DEFAULT_SHELF_NAME, bookIds: [] }]
    };
  }

  function defaultBook(meta = {}) {
    const idValue = meta.id || id.book(meta.title);
    return {
      id: idValue,
      title: meta.title || 'Untitled',
      subtitle: meta.subtitle || '',
      series: meta.series || '',
      author: meta.author || 'Anonymous',
      wordGoal: meta.wordGoal || 0,
      created: meta.created || new Date().toISOString(),
      modified: meta.modified || new Date().toISOString(),
      chapterOrder: Array.isArray(meta.chapterOrder) ? meta.chapterOrder : [],
      tabNames: { ...DEFAULT_TAB_NAMES, ...(meta.tabNames || {}) }
    };
  }

  // Disk-facing code in desktop and Pocket uses these same narrow checks
  // before building paths, so both runtimes reject path-shaped input alike.
  const validators = Object.freeze({
    bookId: (value) => /^book-[a-z0-9][a-z0-9-]*$/i.test(String(value || '')),
    chapterId: (value) => /^ch-[a-z0-9]+(?:-[a-z0-9]+)?$/i.test(String(value || '')),
    auxName: (value) => AUX_HTML_NAMES.includes(String(value || '')),
    jsonSidecar: (value) => JSON_SIDECAR_NAMES.includes(String(value || '')),
    coverFile: (value) => /^(cover|art)-\d+\.(png|jpg|webp)$/i.test(String(value || '')),
    coverExt: (value) => COVER_EXTS.includes(String(value || '').toLowerCase())
  });

  function assertValid(label, value, validator) {
    if (!validator(value)) throw new Error('Invalid ' + label);
    return value;
  }

  // Shared file-name builders stop desktop and Pocket from hand-rolling the
  // same "validate, then append extension" rules in slightly different ways.
  // Each runtime still joins paths its own way: Node path.join vs. Capacitor /.
  const files = Object.freeze({
    bookDir: (bookId) => assertValid('bookId', bookId, validators.bookId),
    chapterHtml: (chapterId) => assertValid('chapterId', chapterId, validators.chapterId) + '.html',
    auxHtml: (name) => assertValid('aux name', name, validators.auxName) + '.html',
    jsonSidecar: (name) => assertValid('JSON sidecar', name, validators.jsonSidecar) + '.json',
    cover: (fname) => assertValid('cover file', fname, validators.coverFile)
  });

  return {
    DEFAULT_SHELF_NAME,
    DEFAULT_TAB_NAMES,
    AUX_HTML_NAMES,
    JSON_SIDECAR_NAMES,
    COVER_EXTS,
    slugify,
    makeId,
    id,
    defaultLibrary,
    defaultBook,
    validators,
    assertValid,
    files
  };
});
