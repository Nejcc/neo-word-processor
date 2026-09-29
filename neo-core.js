/* Shared NEO rules for desktop and Pocket: which library names are allowed.
   Keep this dependency-free: it loads in Electron main via require(),
   and in the Pocket webview as window.NeoCore. */
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

  return { libName };
});
