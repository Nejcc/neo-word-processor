'use strict';

// dictionary-ro@3.0.0 uses single-character flags, with no continuation
// classes. Hunspell lets a prefix and suffix share a flag; nspell 2.1.5
// overwrites the suffix with the prefix. Give those prefixes unused flags
// and attach both flags to each affected word before parsing with nspell.
// The distributed dictionary files stay unchanged.
function prepareRomanianDictionary(dict) {
  let aff = dict.aff.toString('utf8');
  let dic = dict.dic.toString('utf8');
  const headers = [...aff.matchAll(/^(PFX|SFX)\s+(\S)\s+[YN]\s+\d+/gm)];
  const used = new Set(headers.map((m) => m[2]));
  const suffixes = new Set(headers.filter((m) => m[1] === 'SFX').map((m) => m[2]));
  const available = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'].filter((c) => !used.has(c));
  const renamed = new Map();
  for (const [, type, flag] of headers) {
    if (type !== 'PFX' || !suffixes.has(flag)) continue;
    const next = available.shift();
    if (!next) throw new Error('No unused Romanian affix flags');
    renamed.set(flag, next);
  }
  aff = aff.replace(/^PFX\s+(\S)(?=\s)/gm, (line, flag) =>
    renamed.has(flag) ? 'PFX ' + renamed.get(flag) : line);
  dic = dic.replace(/^([^/\r\n]+\/)(\S+)/gm, (_line, word, flags) =>
    word + [...flags].map((flag) => flag + (renamed.get(flag) || '')).join(''));
  return { aff, dic };
}

// Accept legacy cedillas and decomposed accents without editing the text
// or stripping meaningful diacritics. Suggestions use standard spelling.
function normalizeRomanianWord(word) {
  return word.normalize('NFC').replace(/[şţŞŢ]/g, (c) =>
    ({ 'ş': 'ș', 'ţ': 'ț', 'Ş': 'Ș', 'Ţ': 'Ț' })[c]);
}

module.exports = { prepareRomanianDictionary, normalizeRomanianWord };
