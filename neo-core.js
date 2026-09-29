/* Shared NEO rules for desktop and Pocket: library names and IDs.
   Keep this dependency-free: it loads in Electron main via require(),
   and in the desktop renderer/Pocket webviews as window.NeoCore. */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.NeoCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Every book, chapter and sidecar name the page sends is one plain name
  // inside the library: ".", ".." and path separators never reach the disk.
  // Any name NEO ever made passes, and so does a folder named by hand.
  function libName(name) {
    if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
      throw new Error('Invalid library name');
    }
    return name;
  }

  function makeId(prefix, randomLen) {
    const random = randomLen ? '-' + Math.random().toString(36).slice(2, 2 + randomLen) : '';
    return prefix + '-' + Date.now().toString(36) + random;
  }

  const id = Object.freeze({
    shelf: () => makeId('shelf', 0),
    author: () => makeId('a', 0),
    chapter: () => makeId('ch', 4),
    sticky: () => makeId('s', 4),
    darling: () => makeId('d', 4),
    section: () => makeId('sec', 0)
  });

  return { libName, id };
});
