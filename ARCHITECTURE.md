# Architecture Notes

NEO is intentionally small: an Electron main process, a preload bridge, and a plain JavaScript renderer. That simplicity is a feature, but the code should still move toward clearer boundaries, less duplication, and stricter contracts as the app grows.

## Current Shape

- `main.js` owns Electron, menus, filesystem access, import parsing, exports, backups, secrets, spellcheck, and update checks.
- `preload.js` exposes the renderer's allowed capabilities through `window.neo`.
- `app.js` owns the renderer: bookshelf, editor, outline, darlings, stickies, search, spellcheck UI, goals, cover workflows, settings, and export builders.
- `neo-core.js` owns the first shared domain defaults and ID helpers used by desktop, renderer, and Pocket.
- `covers.js` owns generated shelf covers.
- `art.js` owns AI cover painting provider calls.
- `pocket/www/pocket-bridge.js` implements the same `window.neo` API for Android/Capacitor.

This is understandable, but not yet strict. The main risk is drift: book defaults, library defaults, menu constants, font choices, file naming rules, and IPC expectations are repeated across files.

## Runtime And Package Manager

Use Node and npm for now.

```bash
npm install
npm start
```

Do not add Bun unless there is a concrete migration goal and the Electron build/package flow has been tested on macOS, Windows, and Linux. A second package manager would add noise before it solves the real maintainability issues.

Better strictness upgrades, in order:

1. Add focused tests for import/export and editor transformations.
2. Add linting.
3. Add formatting.
4. Add JSDoc or TypeScript only when the module boundaries are clearer.

## DRY And Modularity Targets

Prefer extraction that creates a real ownership boundary. Avoid moving code just to make files smaller.

Good first modules and next extractions:

- `neo-core.js` now holds the first shared defaults and ID helpers. If this grows, move it under `src/shared/schema.js` with tests.
- `src/shared/ids.js`: book/shelf/author/chapter ID creation and slugging.
- `src/main/library-store.js`: all filesystem reads/writes, path validation, catalog writing, and backups.
- `src/main/importer.js`: DOCX/TXT/MD parsing.
- `src/renderer/ui/modal.js`: common modal creation, Escape handling, cancel/confirm buttons, and focus.
- `src/renderer/bookshelf/`: shelves, drag/drop, book tiles, cover actions.
- `src/renderer/editor/`: chapter rendering, typing behavior, structural undo, selection helpers.
- `src/renderer/export/`: TXT, Markdown, HTML, DOCX, EPUB builders.

## Target File Structure

Move toward a structure that separates runtime concerns first, then feature concerns. The goal is to make ownership obvious without hiding the app behind a framework.

```text
src/
  shared/
    schema.js          # defaults, migrations, validators
    ids.js             # readable ID generation and slugging
    contracts.js       # window.neo capability names and payload shapes
  main/
    library-store.js   # filesystem reads/writes, backups, catalog
    importer.js        # DOCX/TXT/Markdown import parsing
    exporter.js        # file export orchestration
    ipc.js             # validate IPC payloads, call main services
    menu.js            # app menu and command wiring
  renderer/
    app-state.js       # library/book/session state
    bookshelf/
    editor/
    outline/
    export/
    ui/
  pocket/
    bridge.js          # Capacitor implementation of the same contracts
  plugins/
    registry.js        # optional capability discovery and registration
```

This can happen gradually. `neo-core.js` is a good first shared seam; it can stay at the project root until there is enough shared code to justify the `src/` move.

## Plugin Direction

Plugins should come after the main boundaries are clearer. A plugin system is useful only if the app already has stable contracts for what can be extended.

Good plugin candidates:

- importers: extra source formats or cleanup rules.
- exporters: extra output formats.
- cover providers: local image generation, remote image generation, or templates.
- editor tools: commands that transform selected text or chapters.
- metadata helpers: series, goals, publishing fields, or catalog enrichments.

Keep early plugins capability-based rather than fully privileged. A plugin should receive a small API, such as `readBook`, `writeChapter`, `registerExporter`, or `registerCommand`, instead of direct filesystem or DOM access. That keeps writer data safer and makes Pocket compatibility easier to reason about.

Avoid a plugin marketplace or dynamic remote loading until local modules, validation, and tests are stronger. Start with built-in plugins or local folders that are loaded explicitly.

## Strict Boundaries

The renderer should not know filesystem paths beyond what it needs to display a cover URL. It should call capability methods on `window.neo`.

The main process should validate every IPC payload before touching disk:

- `bookId`, `chapterId`, shelf IDs, and filenames should match narrow patterns.
- JSON sidecar names should come from an allowlist.
- cover filenames should stay limited to known `cover-*` and `art-*` patterns.
- imported paths should be checked by extension and handled as untrusted input.

The Pocket bridge should implement the same contract as `preload.js`; if a capability is missing on Pocket, the behavior should be deliberate and documented.

Current enforcement is `NeoCore.libName` in `neo-core.js`: every book, chapter, notes/outline and sidecar name must be one plain name (no `.`, `..` or path separators). The desktop main process uses it for every renderer-supplied name, and the Pocket bridge applies it to every path segment. It is deliberately tolerant — any name NEO ever made passes, and so does a folder named by hand. New disk-facing handlers should run caller-supplied names through it before building paths.

## Duplication To Retire

- Book and library defaults currently appear in both desktop and Pocket paths.
- Font choices are split between renderer settings and main-process menus.
- Modal markup and Escape/cancel wiring are repeated in several renderer features.
- Save scheduling and persistence calls are scattered through renderer workflows.
- Import logic and export logic are domain code but currently live inside Electron/DOM-heavy files.

## Testing Priorities

Start with small, high-value tests around pure functions and extracted modules:

- DOCX/TXT/Markdown import chapter detection.
- HTML paragraph cleanup for export.
- Markdown escaping and emphasis preservation.
- ID/slug generation.
- schema migrations/defaults.
- chapter split/merge transformations once the editor logic is isolated enough to test.

The goal is not a heavy framework. The goal is confidence that writer data survives changes.
