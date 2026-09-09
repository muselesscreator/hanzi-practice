#!/usr/bin/env node
/**
 * Builds data/curriculum.json and data/strokes/unit-NN.json.
 *
 * Ordering: characters are sorted so that you never meet a character before
 * the characters it is built out of. Within that constraint, earlier HSK
 * level wins, then higher corpus frequency. See README for why this beats
 * a thematic (Rosetta-Stone-style) sequence for handwriting.
 *
 * Sources (downloaded to tools/cache on first run):
 *   - drkameleon/complete-hsk-vocabulary  (levels, pinyin, meanings, frequency)
 *   - skishore/makemeahanzi              (IDS decomposition, glosses, etymology)
 *   - hanzi-writer-data (npm)            (stroke outlines + medians)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools', 'cache');
const DATA = path.join(ROOT, 'data');

const SOURCES = {
  'hsk-complete.json':
    'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json',
  'makemeahanzi-dictionary.txt':
    'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt',
};

// --- config ------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const MAX_LEVEL = Number(args.levels ?? 4); // HSK 3.0 bands 1..MAX_LEVEL
const LESSON_SIZE = Number(args.lesson ?? 8); // characters per lesson
const LESSONS_PER_UNIT = Number(args.unit ?? 5);

// --- helpers -----------------------------------------------------------

const IDC = /[\u2FF0-\u2FFB]/g; // ideographic description characters
const CJK = /[\u4E00-\u9FFF]/;

async function ensure(name) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(CACHE, { recursive: true });
  process.stdout.write(`fetching ${name}\n`);
  const res = await fetch(SOURCES[name]);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

function strokeDataDir() {
  const local = path.join(CACHE, 'hanzi-writer-data');
  if (fs.existsSync(local)) return local;
  const dep = path.join(ROOT, 'node_modules', 'hanzi-writer-data');
  if (fs.existsSync(dep)) return dep;
  throw new Error(
    'stroke data missing. run: npm install hanzi-writer-data\n' +
      '(or place the package at tools/cache/hanzi-writer-data)'
  );
}

// Direct components of a character, per its IDS decomposition.
function componentsOf(ids) {
  if (!ids) return [];
  return [...ids.replace(IDC, '')].filter((c) => c !== '？' && CJK.test(c));
}

// --- load --------------------------------------------------------------

const hsk = JSON.parse(fs.readFileSync(await ensure('hsk-complete.json'), 'utf8'));
const mmahLines = fs
  .readFileSync(await ensure('makemeahanzi-dictionary.txt'), 'utf8')
  .split('\n')
  .filter(Boolean);

const mmah = new Map();
for (const line of mmahLines) {
  const e = JSON.parse(line);
  mmah.set(e.character, e);
}

const STROKES = strokeDataDir();
const hasStrokes = (ch) => fs.existsSync(path.join(STROKES, `${ch}.json`));

const strokeCountCache = new Map();
function strokeCount(ch) {
  if (!strokeCountCache.has(ch)) {
    const d = JSON.parse(fs.readFileSync(path.join(STROKES, `${ch}.json`), 'utf8'));
    strokeCountCache.set(ch, d.strokes?.length ?? 99);
  }
  return strokeCountCache.get(ch);
}

// --- assign each character a level and a frequency ---------------------

const charLevel = new Map(); // char -> earliest HSK band it appears in
const charFreq = new Map(); // char -> best (lowest) frequency rank
const wordsByChar = new Map(); // char -> example words

for (const entry of hsk) {
  const bands = entry.level
    .filter((l) => l.startsWith('new-'))
    .map((l) => Number(l.slice(4)))
    .filter((n) => Number.isFinite(n));
  if (!bands.length) continue;
  const level = Math.min(...bands);
  if (level > MAX_LEVEL) continue;

  const form = entry.forms?.[0];
  const word = {
    word: entry.simplified,
    pinyin: form?.transcriptions?.pinyin ?? '',
    meaning: (form?.meanings ?? [])[0] ?? '',
    level,
    freq: entry.frequency ?? 1e9,
  };

  for (const ch of new Set([...entry.simplified].filter((c) => CJK.test(c)))) {
    if (!charLevel.has(ch) || level < charLevel.get(ch)) charLevel.set(ch, level);
    if (!charFreq.has(ch) || word.freq < charFreq.get(ch)) charFreq.set(ch, word.freq);
    if (!wordsByChar.has(ch)) wordsByChar.set(ch, []);
    wordsByChar.get(ch).push(word);
  }
}

const deck = new Set(
  [...charLevel.keys()].filter((ch) => hasStrokes(ch) && mmah.has(ch))
);

const dropped = [...charLevel.keys()].filter((ch) => !deck.has(ch));
if (dropped.length) {
  process.stdout.write(`skipping ${dropped.length} chars with no stroke data\n`);
}

// --- topological sort by component dependency --------------------------

// A component is a hard prerequisite only if it is itself taught at the same
// HSK band or earlier. Without that guard, one HSK-1 character containing a
// rare component drags that component to the very front of the course, and
// you spend your first week writing characters you will not read for years.
// Later-level components still get shown on the card, just not drilled first.
const deps = new Map(); // char -> Set of prerequisite chars
for (const ch of deck) {
  const parts = componentsOf(mmah.get(ch)?.decomposition);
  deps.set(
    ch,
    new Set(
      parts.filter(
        (p) => p !== ch && deck.has(p) && charLevel.get(p) <= charLevel.get(ch)
      )
    )
  );
}

// Break any cycles (rare, from mutually-recursive IDS entries) by dropping
// the edge that points at the later-level character.
function breakCycles() {
  const state = new Map();
  const stack = [];
  const visit = (ch) => {
    const s = state.get(ch);
    if (s === 'done') return;
    if (s === 'open') {
      const start = stack.lastIndexOf(ch);
      const cycle = stack.slice(start);
      const worst = cycle.reduce((a, b) =>
        rank(a) > rank(b) ? a : b
      );
      const prev = cycle[(cycle.indexOf(worst) + cycle.length - 1) % cycle.length];
      deps.get(prev)?.delete(worst);
      return;
    }
    state.set(ch, 'open');
    stack.push(ch);
    for (const d of [...(deps.get(ch) ?? [])]) visit(d);
    stack.pop();
    state.set(ch, 'done');
  };
  for (const ch of deck) visit(ch);
}

// Within an HSK band, prefer characters that are both common and easy to
// write. STROKE_WEIGHT is how many places of frequency rank one extra stroke
// is worth; at 250, a very common 12-stroke character still lands early, but
// among equally common characters the simpler one always comes first.
const STROKE_WEIGHT = Number(args.strokeWeight ?? 250);
const rank = (ch) =>
  (charLevel.get(ch) ?? 9) * 1e7 +
  Math.min(charFreq.get(ch) ?? 1e6, 1e6) +
  strokeCount(ch) * STROKE_WEIGHT;
breakCycles();

const dependents = new Map();
for (const ch of deck) dependents.set(ch, []);
for (const [ch, ds] of deps) for (const d of ds) dependents.get(d).push(ch);

const remaining = new Map([...deps].map(([ch, ds]) => [ch, ds.size]));
const ready = [...deck].filter((ch) => remaining.get(ch) === 0);
const order = [];

while (ready.length) {
  // pick the cheapest available character: earliest level, then most common
  let best = 0;
  for (let i = 1; i < ready.length; i++) {
    if (rank(ready[i]) < rank(ready[best])) best = i;
  }
  const ch = ready.splice(best, 1)[0];
  order.push(ch);
  for (const dep of dependents.get(ch)) {
    remaining.set(dep, remaining.get(dep) - 1);
    if (remaining.get(dep) === 0) ready.push(dep);
  }
}

if (order.length !== deck.size) {
  throw new Error(`sort incomplete: ${order.length} of ${deck.size}`);
}

// --- build the card records --------------------------------------------

const position = new Map(order.map((ch, i) => [ch, i]));

function partsFor(ch) {
  const raw = componentsOf(mmah.get(ch)?.decomposition);
  const seen = new Set();
  const out = [];
  for (const p of raw) {
    if (p === ch || seen.has(p)) continue;
    seen.add(p);
    const m = mmah.get(p);
    out.push({
      char: p,
      gloss: m?.definition ?? null,
      known: deck.has(p) && position.get(p) < position.get(ch),
    });
  }
  return out;
}

// A few real words that use this character, most common first. Words made
// entirely of already-introduced characters come first (you can read the
// whole thing), then the list is topped up with the most common remaining
// words so even a brand-new character still gets some context.
const EXAMPLES_PER_CARD = 3;
function examplesFor(ch) {
  const seen = new Set();
  const words = (wordsByChar.get(ch) ?? []).filter((w) => {
    if ([...w.word].length < 2 || seen.has(w.word)) return false;
    seen.add(w.word);
    return true;
  });
  const readable = (w) =>
    [...w.word].every(
      (c) => !CJK.test(c) || (deck.has(c) && position.get(c) <= position.get(ch))
    );
  const byFreq = (a, b) => a.freq - b.freq;
  const known = words.filter(readable).sort(byFreq);
  const rest = words.filter((w) => !readable(w)).sort(byFreq);
  return [...known, ...rest]
    .slice(0, EXAMPLES_PER_CARD)
    .map((w) => ({ word: w.word, pinyin: w.pinyin, meaning: w.meaning }));
}

const cards = order.map((ch, i) => {
  const m = mmah.get(ch);
  const self = (wordsByChar.get(ch) ?? []).find((w) => w.word === ch);
  return {
    i,
    char: ch,
    pinyin: self?.pinyin ?? (m?.pinyin ?? [])[0] ?? '',
    meaning: self?.meaning ?? m?.definition ?? '',
    level: charLevel.get(ch),
    strokes: strokeCount(ch),
    radical: m?.radical ?? null,
    hint: m?.etymology?.hint ?? null,
    parts: partsFor(ch),
    examples: examplesFor(ch),
  };
});

// --- chunk into lessons and units --------------------------------------

const perUnit = LESSON_SIZE * LESSONS_PER_UNIT;
const units = [];
for (let u = 0; u * perUnit < cards.length; u++) {
  const slice = cards.slice(u * perUnit, (u + 1) * perUnit);
  const lessons = [];
  for (let l = 0; l * LESSON_SIZE < slice.length; l++) {
    lessons.push(slice.slice(l * LESSON_SIZE, (l + 1) * LESSON_SIZE).map((c) => c.i));
  }
  const levels = [...new Set(slice.map((c) => c.level))].sort();
  units.push({
    n: u + 1,
    levels,
    lessons,
    from: slice[0].char,
    to: slice[slice.length - 1].char,
  });
}

// --- write ---------------------------------------------------------------

fs.mkdirSync(path.join(DATA, 'strokes'), { recursive: true });
fs.rmSync(path.join(DATA, 'strokes'), { recursive: true, force: true });
fs.mkdirSync(path.join(DATA, 'strokes'), { recursive: true });

fs.writeFileSync(
  path.join(DATA, 'curriculum.json'),
  JSON.stringify(
    {
      built: new Date().toISOString().slice(0, 10),
      maxLevel: MAX_LEVEL,
      lessonSize: LESSON_SIZE,
      lessonsPerUnit: LESSONS_PER_UNIT,
      units,
      cards,
    },
    null,
    0
  )
);

for (const unit of units) {
  const chars = unit.lessons.flat().map((i) => cards[i].char);
  const bundle = {};
  for (const ch of chars) {
    bundle[ch] = JSON.parse(fs.readFileSync(path.join(STROKES, `${ch}.json`), 'utf8'));
  }
  fs.writeFileSync(
    path.join(DATA, 'strokes', `unit-${String(unit.n).padStart(2, '0')}.json`),
    JSON.stringify(bundle)
  );
}

const byLevel = {};
for (const c of cards) byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;

process.stdout.write(
  `\n${cards.length} characters, ${units.length} units, ${units.reduce(
    (n, u) => n + u.lessons.length,
    0
  )} lessons\n` +
    Object.entries(byLevel)
      .map(([l, n]) => `  HSK ${l}: ${n}`)
      .join('\n') +
    '\n'
);
