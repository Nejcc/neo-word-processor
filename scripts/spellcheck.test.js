'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const nspell = require('nspell');
const { prepareRomanianDictionary } = require('../spell-ro');

const root = path.join(__dirname, '..');
const localRequire = createRequire(path.join(root, 'main.js'));
const source = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('Romanian compatibility keeps suffixes, prefixes and their combinations', () => {
  const dict = prepareRomanianDictionary({
    aff: 'SET UTF-8\nSFX A Y 1\nSFX A 0 s .\nPFX A Y 1\nPFX A 0 re .\n',
    dic: '1\nword/A\n'
  });
  const spell = nspell(dict);
  for (const word of ['word', 'words', 'reword', 'rewords']) assert.ok(spell.correct(word), word);
  assert.equal(spell.correct('wordss'), false);
});

test('pinned Romanian dictionary fits the single-character flag conversion', () => {
  const dir = path.join(root, 'node_modules/dictionary-ro');
  const aff = fs.readFileSync(path.join(dir, 'index.aff'), 'utf8');
  const dic = fs.readFileSync(path.join(dir, 'index.dic'), 'utf8');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version, '3.0.0');
  // Re-evaluate the converter before accepting another format or special flags.
  assert.doesNotMatch(aff, /^(FLAG|AF|COMPOUND\w*|NEEDAFFIX|FORBIDDENWORD|KEEPCASE|CIRCUMFIX|ONLYINCOMPOUND)\s/m);
  assert.doesNotMatch(aff, /^(?:PFX|SFX)\s+\S+\s+\S+\s+\S*\//m);
  for (const line of dic.split('\n')) {
    // Two upstream entries contain stray slashes in their flags; retain them.
    if (line.includes('/')) assert.match(line, /^[^/]+\/[A-Za-z/]+$/);
  }
});

function spellWorker() {
  let handle, reply;
  const context = vm.createContext({
    require: localRequire,
    process: { parentPort: {
      on: (_name, callback) => { handle = callback; },
      postMessage: (message) => { reply = message; }
    } }
  });
  vm.runInContext(source('spell-worker.js'), context);
  let id = 0;
  return (message) => {
    handle({ data: { id: ++id, ...message } });
    assert.equal(reply.id, id);
    return reply;
  };
}

test('worker checks Romanian, suggests, learns and switches languages', () => {
  const send = spellWorker();
  const load = (language, pkg, custom = []) => {
    assert.equal(send({ type: 'load', language, dir: path.join(root, 'node_modules', pkg), custom }).ok, true);
  };
  const check = (words, expected) => {
    const res = send({ type: 'check', words });
    assert.equal(res.ok, true);
    assert.deepEqual(Object.keys(res.result), words);
    for (const word of words) assert.equal(res.result[word], expected, word);
  };
  check(['frgament'], true); // no dictionary yet
  load('ro', 'dictionary-ro', ['Zorţilă']);
  check(['Acest', 'fragment', 'ar', 'trebui', 'să', 'fie', 'corect',
    'trebuia', 'trebuit', 'trebuiau', 'citi', 'merge', 'reciti', 'recitit',
    'română', 'școală', 'țară', 'Știință', 'mănâncă', 'învățăm', 'sa',
    'şcoală', 'ţară', 'Ştiinţă', 'Țară'.normalize('NFD'),
    'şcoală'.normalize('NFD'), 'română'.normalize('NFD'),
    'Zorțilă', 'Zorţilă'.normalize('NFD')], true);
  check(['acset', 'frgament', 'coretc', 'școaală', 'scoala', 'țarra'], false);
  for (const [word, wanted] of [['frgament', 'fragment'], ['coretc', 'corect'],
    ['şcoaală', 'școală'], ['școaală'.normalize('NFD'), 'școală']]) {
    const suggestions = send({ type: 'suggest', word }).result;
    assert.ok(suggestions.includes(wanted), word);
    assert.ok(suggestions.length <= 6);
  }
  assert.equal(send({ type: 'add', word: 'Nerțulică'.normalize('NFD') }).ok, true);
  check(['Nerțulică', 'Nerţulică', 'Nerţulică'.normalize('NFD')], true);
  assert.equal(send({ type: 'load', language: 'en-US', dir: '/no-such-neo-dictionary' }).ok, false);
  check(['şcoală', 'trebui'], true); // failed load keeps the previous dictionary and normalization
  load('en-US', 'dictionary-en-us', ['Zorţilă']);
  check(['This', 'sentence', 'should', 'be', 'correct', 'Zorţilă'], true);
  check(['frgament', 'Zorțilă'], false); // Romanian normalization does not leak into English
  load('ro', 'dictionary-ro', ['Nerţulică']);
  check(['Nerțulică', 'Nerţulică'.normalize('NFD'), 'trebui'], true);
});

test('learning a Romanian word removes cached Unicode-variant underlines across editors', async () => {
  const send = spellWorker();
  assert.equal(send({ type: 'load', language: 'ro', dir: path.join(root, 'node_modules/dictionary-ro') }).ok, true);
  const variants = ['Nerţulică', 'Nerțulică', 'Nerțulică'.normalize('NFD')];
  const makeEditor = (text, id) => {
    const node = { data: text, nodeType: 3, isConnected: true };
    return {
      node, id, dataset: { kind: 'notes' },
      closest: (selector) => selector === '.chapter' ? { dataset: { id } } : editors[id]
    };
  };
  const editors = {
    'ch-test': makeEditor(variants.slice(0, 2).join(' ') + ' frgament', 'ch-test'),
    'aux-editor': makeEditor(variants[2] + ' coretc', 'aux-editor')
  };
  const originalText = Object.values(editors).map((el) => el.node.data);
  let contextmenu, actions, savedLibrary;
  class TextRange {
    setStart(node, offset) { this.node = node; this.start = offset; }
    setEnd(_node, offset) { this.end = offset; }
    toString() { return this.node.data.slice(this.start, this.end); }
  }
  const highlights = new Map();
  const context = vm.createContext({
    document: {
      addEventListener: (name, callback) => { if (name === 'contextmenu') contextmenu = callback; },
      createTreeWalker: (el) => {
        let node = el.node;
        return { nextNode: () => { const next = node; node = null; return next; } };
      },
      querySelector: (selector) => selector.startsWith('.chapter[') ? editors['ch-test'] : null,
      caretRangeFromPoint: () => ({ startContainer: editors['ch-test'].node, startOffset: 2 })
    },
    Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4 }, Range: TextRange,
    Highlight: Set, CSS: { highlights },
    $: () => editors['aux-editor'], t: (text) => text, toast() {},
    currentTab: 'manuscript', currentChapterId: 'ch-test', library: {},
    captureMenu: (_x, _y, _word, _suggestions, callbacks) => { actions = callbacks; },
    window: { neo: {
      spellCheckWords: async (words) => send({ type: 'check', words }).result,
      spellSuggest: async (word) => send({ type: 'suggest', word }).result,
      spellLearn: async (word) => send({ type: 'add', word }).ok,
      writeLibrary: async (library) => { savedLibrary = JSON.parse(JSON.stringify(library)); }
    } }
  });
  // app.js saves the library through its own writeLibrary(), which counts
  // writes before handing them to window.neo
  context.writeLibrary = (lib) => context.window.neo.writeLibrary(lib);
  const app = source('app.js');
  // Use the real scanner, cache and context-menu learn callback. Only DOM
  // primitives and IPC transport are replaced; the worker loads nspell.
  vm.runInContext(app.slice(app.indexOf('let spellOn = false;'), app.indexOf('let typewriterEnabled = false;')), context);
  vm.runInContext('spellOn = true; showSpellMenu = captureMenu;', context);
  await vm.runInContext('Promise.all([spellScanEl(spellElFor("ch-test"), "ch-test"), spellScanEl(spellElFor("aux-notes"), "aux-notes")])', context);
  const flagged = () => [...highlights.get('neo-spell')].map((range) => range.toString());
  assert.deepEqual(flagged(), [variants[0], variants[1], 'frgament', variants[2], 'coretc']);
  await contextmenu({ target: editors['ch-test'], clientX: 0, clientY: 0, preventDefault() {} });
  assert.ok(actions);
  await actions.learn();
  // The existing learn callback starts asynchronous rescans without awaiting them.
  await new Promise(setImmediate);
  assert.deepEqual(flagged(), ['frgament', 'coretc']);
  assert.deepEqual(savedLibrary.customWords, [variants[0]]);
  assert.deepEqual(Object.values(editors).map((el) => el.node.data), originalText);
  assert.equal(vm.runInContext('spellOn', context), true);
  vm.runInContext('toggleSpellcheck();', context);
  assert.equal(highlights.has('neo-spell'), false);
  vm.runInContext('toggleSpellcheck();', context);
  await new Promise(setImmediate);
  assert.deepEqual(flagged(), ['frgament']);
});

// Run the real main-process startup functions against a temporary library.
// Only Electron's window/worker APIs are replaced; settings and library IO
// use the same code and files as the app.
function mainContext(temp, systemLocale, settings = {}, library = {}, raw = null) {
  fs.writeFileSync(path.join(temp, 'settings.json'), JSON.stringify(settings));
  fs.writeFileSync(path.join(temp, 'library.json'), raw === null ? JSON.stringify(library) : raw);
  const loads = [], handlers = new Map();
  let receive;
  const electron = {
    app: {
      commandLine: { appendSwitch() {} },
      getPath: () => temp,
      getLocale: () => systemLocale,
      requestSingleInstanceLock: () => true,
      whenReady: () => ({ then() {} }),
      on() {}
    },
    ipcMain: { on() {}, handle: (name, fn) => handlers.set(name, fn) },
    BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
    Menu: { buildFromTemplate: (items) => items, setApplicationMenu() {} },
    utilityProcess: { fork: () => ({
      on: (name, fn) => { if (name === 'message') receive = fn; },
      postMessage: (message) => {
        loads.push(message);
        queueMicrotask(() => receive({ id: message.id, ok: true }));
      }
    }) }
  };
  const context = vm.createContext({
    require: (name) => name === 'electron' ? electron : localRequire(name),
    __dirname: root,
    process: { platform: process.platform, on() {} },
    console,
    temp
  });
  vm.runInContext(source('main.js'), context);
  vm.runInContext('LIBRARY_DIR = temp; LIBRARY_FILE = require("path").join(temp, "library.json"); initLanguage(); initSpell();', context);
  return { context, loads, handlers, read: () => JSON.parse(fs.readFileSync(path.join(temp, 'library.json'))) };
}

test('spellcheck follows the interface until a dictionary is picked; nothing is saved for the writer', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-spell-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const fresh = mainContext(temp, 'ro_RO', {}, { authorName: 'Autor', customWords: ['Zorțilă'] });
  assert.equal(fresh.read().spellLanguage, undefined); // not saved on the writer's behalf
  assert.equal(fresh.read().authorName, 'Autor');
  assert.equal(vm.runInContext('spellLanguage', fresh.context), 'ro');
  assert.equal(fresh.loads[0].language, 'ro');
  assert.deepEqual(Array.from(fresh.loads[0].custom), ['Zorțilă']);
  // switching the interface takes a dictionary nobody picked along with it
  vm.runInContext('setUiLanguage("en")', fresh.context);
  assert.equal(vm.runInContext('spellLanguage', fresh.context), 'en-US');
  assert.equal(fresh.loads.length, 2);
  assert.equal(fresh.loads[1].language, 'en-US');
  assert.equal(fresh.read().spellLanguage, undefined);
  await Promise.resolve();

  // the same rule for every language: its own dictionary when NEO has one
  for (const [locale, code] of [['ru_RU', 'ru'], ['fr-CA', 'fr'], ['de', 'de'], ['pl', 'pl'], ['en-US', 'en-US'], ['it', 'en-US'], ['pt-BR', 'en-US']]) {
    const ui = mainContext(temp, locale);
    assert.equal(ui.loads[0].language, code, locale);
    assert.equal(ui.read().spellLanguage, undefined);
    await Promise.resolve();
  }

  // a dictionary picked in Edit → Spellcheck Language wins, whatever the interface
  for (const code of ['en-US', 'en-GB', 'fr', 'ro']) {
    const explicit = mainContext(temp, 'ro-RO', {}, { spellLanguage: code });
    assert.equal(explicit.loads[0].language, code);
    assert.equal(explicit.read().spellLanguage, code);
    vm.runInContext('setUiLanguage("de")', explicit.context);
    assert.equal(explicit.loads.length, 1);
    await Promise.resolve();
  }

  // a library.json that doesn't parse is never touched
  const broken = '{"shelves": [{"id": "shelf-1", "name": "Mine"';
  const unreadable = mainContext(temp, 'ro_RO', {}, {}, broken);
  assert.equal(fs.readFileSync(path.join(temp, 'library.json'), 'utf8'), broken);
  assert.equal(unreadable.loads[0].language, 'ro');
  await Promise.resolve();
});
