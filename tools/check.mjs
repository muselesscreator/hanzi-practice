#!/usr/bin/env node
/** Sanity checks on the generated curriculum and the scheduling maths. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fsrs, generatorParameters, createEmptyCard, Rating } from '../vendor/ts-fsrs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/curriculum.json'), 'utf8'));

let failures = 0;
const check = (name, ok, detail = '') => {
  process.stdout.write(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}\n`);
  if (!ok) failures++;
};

// 1. every card index matches its position
check('card indices are contiguous', c.cards.every((x, i) => x.i === i));

// 2. no character appears before a component it is built from
const pos = new Map(c.cards.map((x, i) => [x.char, i]));
const bad = c.cards.flatMap((x) =>
  x.parts.filter((p) => p.known && pos.get(p.char) > x.i).map((p) => `${x.char}<${p.char}`)
);
check('components always precede their characters', bad.length === 0, bad.slice(0, 5).join(' '));

// 3. HSK levels are non-decreasing across the sequence, allowing the
//    dependency sort to pull a few characters forward
const inversions = c.cards.filter((x, i) => i > 0 && x.level < c.cards[i - 1].level).length;
check('level drift stays small', inversions < c.cards.length * 0.05, `${inversions} inversions`);

// 4. every unit has a stroke bundle covering all of its characters
const gaps4 = [];
for (const u of c.units) {
  const file = path.join(ROOT, `data/strokes/unit-${String(u.n).padStart(2, '0')}.json`);
  if (!fs.existsSync(file)) {
    gaps4.push(`unit ${u.n} missing`);
    continue;
  }
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  const chars = u.lessons.flat().map((i) => c.cards[i].char);
  const missing = chars.filter((ch) => !bundle[ch]?.strokes?.length);
  if (missing.length) gaps4.push(`unit ${u.n}: ${missing.join('')}`);
}
check(`all ${c.units.length} unit bundles complete`, gaps4.length === 0, gaps4.slice(0, 3).join('; '));

// 5. stroke counts on cards match the stroke data
const u1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/strokes/unit-01.json'), 'utf8'));
const mismatched = c.cards
  .filter((x) => u1[x.char])
  .filter((x) => u1[x.char].strokes.length !== x.strokes);
check('stroke counts agree with stroke data', mismatched.length === 0);

// 6. cards carry the fields the UI reads
const incomplete = c.cards.filter((x) => !x.char || !x.pinyin || !x.meaning);
check('every card has char, pinyin, meaning', incomplete.length === 0,
  incomplete.slice(0, 5).map((x) => x.char).join(''));

// 7. scheduling behaves: Good grows the interval, Again collapses it
const f = fsrs(generatorParameters({ enable_fuzz: false }));
let card = createEmptyCard(new Date('2026-01-01'));
const gaps = [];
let when = new Date('2026-01-01');
for (let i = 0; i < 5; i++) {
  const next = f.next(card, when, Rating.Good).card;
  gaps.push(Math.round((next.due - when) / 86400000));
  card = next;
  when = new Date(next.due);
}
check('intervals expand under Good', gaps.every((g, i) => i === 0 || g >= gaps[i - 1]), gaps.join('d '));

const lapsed = f.next(card, when, Rating.Again).card;
check('Again collapses the interval', (lapsed.due - when) / 86400000 < gaps.at(-1));

// ── the course ────────────────────────────────────────────────────────

process.stdout.write('\ncourse\n');

const co = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/course.json'), 'utf8'));
const readyUnits = co.units.filter((u) => u.ready);

check('the course has at least one unit with content', readyUnits.length > 0);

// 8. lesson order is contiguous within each book, and every section lists
//    exactly the units that claim it
const orderBad = [];
for (const sec of co.sections) {
  const own = co.units.filter((u) => u.book === sec.n).map((u) => u.id);
  if (own.join() !== sec.units.join()) orderBad.push(`book ${sec.n}`);
  const lessons = co.units.filter((u) => u.book === sec.n).map((u) => u.lesson);
  if (lessons.some((n, i) => n !== i + 1)) orderBad.push(`book ${sec.n} lesson numbers`);
}
check('sections and lesson numbers line up', orderBad.length === 0, orderBad.join('; '));

// 9. THE coverage rule: a sentence may only use words taught by its own unit
//    or an earlier one. This is what keeps early lessons readable.
const taughtBy = new Map(); // word string -> index of the unit that teaches it
readyUnits.forEach((u, i) => {
  for (const wid of u.words) taughtBy.set(co.words[wid].word, i);
});
const early = [];
readyUnits.forEach((u, i) => {
  for (const sid of u.sentences) {
    for (const t of co.sentences[sid].tokens) {
      const at = taughtBy.get(t);
      if (at === undefined || at > i) early.push(`${sid}:${t}`);
    }
  }
});
check('sentences only use words already taught', early.length === 0, early.slice(0, 5).join(' '));

// 10. tokens rebuild the sentence they came from
const tokenBad = Object.values(co.sentences).filter(
  (s) => s.tokens.join('') !== s.zh.replace(/[，。！？、：；“”‘’]/g, '')
);
check('sentence tokens rebuild the sentence', tokenBad.length === 0,
  tokenBad.slice(0, 3).map((s) => s.id).join(' '));

// 11. every id a unit points at actually exists
const dangling = [];
for (const u of co.units) {
  for (const id of u.words) if (!co.words[id]) dangling.push(id);
  for (const id of u.grammar) if (!co.grammar[id]) dangling.push(id);
  for (const id of u.sentences) if (!co.sentences[id]) dangling.push(id);
  for (const ch of u.writing) if (!co.chars[ch]) dangling.push(ch);
}
check('unit references all resolve', dangling.length === 0, dangling.slice(0, 5).join(' '));

// 12. words carry what the exercises read off them
const thinWords = Object.values(co.words).filter(
  (w) => !w.word || !w.pinyin || !w.meaning || !w.tones.length || !w.chars.length
);
check('every word has pinyin, a gloss and tones', thinWords.length === 0,
  thinWords.slice(0, 5).map((w) => w.word).join(' '));

// 13. every grammar point is reachable from its unit and has an example
const orphanGrammar = Object.values(co.grammar).filter(
  (g) => !co.units.find((u) => u.grammar.includes(g.id))
);
check('every grammar point belongs to a unit', orphanGrammar.length === 0,
  orphanGrammar.map((g) => g.id).join(' '));
const untipped = Object.values(co.grammar).filter((g) => !g.tip || !g.pattern);
check('every grammar point has a pattern and a tip', untipped.length === 0,
  untipped.map((g) => g.id).join(' '));

// 14. a character never appears in the writing track before its components
const wPos = new Map();
readyUnits.forEach((u) => u.writing.forEach((ch) => wPos.set(ch, wPos.size)));
const outOfOrder = [];
for (const [ch, at] of wPos) {
  for (const p of co.chars[ch].parts) {
    if (wPos.has(p.char) && wPos.get(p.char) > at) outOfOrder.push(`${ch}<${p.char}`);
  }
}
check('writing track puts components first', outOfOrder.length === 0,
  outOfOrder.slice(0, 5).join(' '));

// 15. every writing-track character carries what a writing card needs, and
//     says which unit it belongs to
const thinChars = [];
for (const u of readyUnits) {
  for (const ch of u.writing) {
    const card = co.chars[ch];
    if (!card.pinyin || !card.meaning || !card.strokes) thinChars.push(ch);
    else if (card.unit !== u.id) thinChars.push(`${ch}@${card.unit}`);
  }
}
check('every writing card has pinyin, a gloss, strokes and a unit',
  thinChars.length === 0, thinChars.slice(0, 5).join(' '));

// 16. a building block is a character no taught word uses, so it has no
//     example words; anything else is either a word itself or has one
const blockBad = Object.values(co.chars).filter((card) =>
  card.block
    ? card.examples.length > 0
    : !co.words[`w:${card.char}`] && card.examples.length === 0
);
check('blocks and full characters are told apart by their words',
  blockBad.length === 0, blockBad.slice(0, 5).map((c) => c.char).join(''));

const exampleBad = Object.values(co.chars).flatMap((card) =>
  card.examples
    .filter((e) => !co.words[`w:${e.word}`] || !e.word.includes(card.char))
    .map((e) => `${card.char}:${e.word}`)
);
check('example words exist and contain their character',
  exampleBad.length === 0, exampleBad.slice(0, 5).join(' '));

// 17. every unit in the writing track has a stroke bundle
const bundleGaps = [];
for (const u of readyUnits) {
  if (!u.writing.length) continue;
  const file = path.join(ROOT, `data/units/${u.id}.json`);
  if (!fs.existsSync(file)) {
    bundleGaps.push(`${u.id} missing`);
    continue;
  }
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = u.writing.filter((ch) => !bundle[ch]?.strokes?.length);
  if (missing.length) bundleGaps.push(`${u.id}: ${missing.join('')}`);
}
check('every unit bundle covers its writing track', bundleGaps.length === 0,
  bundleGaps.slice(0, 3).join('; '));

// ── the store and the lesson generator ────────────────────────────────

process.stdout.write('\nruntime\n');

// A minimal localStorage so the store module can be exercised off-browser.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

// 18. a v1 backup migrates to the current shape without losing a card
const v1 = {
  v: 1,
  settings: { newPerDay: 12, readCards: false },
  cards: {
    '一:w': { due: '2026-02-01T00:00:00.000Z', stability: 3, difficulty: 5, reps: 2 },
    '一:r': { due: '2026-02-05T00:00:00.000Z', stability: 2, difficulty: 5, reps: 1 },
  },
  intro: { '2026-01-31': 4 },
};
mem.set('hanzi-practice:v1', JSON.stringify(v1));
const S = await import('../js/store.js');
const migrated = S.load();
check(`v1 migrates to v${S.VERSION}`, migrated.v === S.VERSION);
check('migration keeps every FSRS card', Object.keys(migrated.cards).length === 2,
  Object.keys(migrated.cards).join(' '));
check('migration keeps settings', migrated.settings.newPerDay === 12 &&
  migrated.settings.readCards === false);
check('migration keeps introduction dates', migrated.intro['2026-01-31'] === 4);
check('migration adds course state', Boolean(migrated.course?.progress) &&
  Boolean(migrated.course?.xp) && migrated.course?.streak?.freeze === 1);
check('migration adds the retrieval counter', Boolean(migrated.exposure) &&
  Object.keys(migrated.exposure).length === 0);
check('card dates come back as Dates', migrated.cards['一:w'].due instanceof Date);

// 18b. a v2 record migrates in place, and the retrieval counter accumulates
mem.clear();
mem.set('hanzi-practice:v1', JSON.stringify({
  v: 2,
  settings: { newPerDay: 5 },
  cards: { 'w:你:r': { due: '2026-02-01T00:00:00.000Z', stability: 2, difficulty: 5 } },
  intro: {},
  course: { progress: { b1l1: { done: 2 } }, xp: {}, streak: { n: 3, last: null, freeze: 1 } },
}));
const v2 = S.load();
check(`v2 migrates to v${S.VERSION}`, v2.v === S.VERSION && Object.keys(v2.cards).length === 1);
check('v2 keeps course progress', v2.course.progress.b1l1.done === 2);
check('a word starts with no retrievals', S.exposureOf('w:你', 'r') === 0);
S.countExposure('w:你', 'r', 2);
S.countExposure('w:你', 'r', 1);
check('retrievals accumulate', S.exposureOf('w:你', 'r') === 3);
check('a zero count is not recorded', (S.countExposure('w:好', 'r', 0),
  S.exposureOf('w:好', 'r') === 0));

// 19. card keys with colons in the id still split correctly
check('key parsing survives colons in ids',
  S.idOf('w:名字:r') === 'w:名字' && S.kindOf('w:名字:r') === 'r' &&
  S.idOf('一:w') === '一' && S.kindOf('一:w') === 'w');
check('key kinds are told apart by id prefix',
  S.isWordKey('w:你:r') && S.isSentKey('s:b1l1-01:b') && S.isCharKey('一:r') &&
  !S.isCharKey('w:你:r'));

// 20. the generator produces a full, playable lesson at every level
mem.clear();
const C = await import('../js/course.js');
const E = await import('../js/exercises.js');
await C.loadCourse(co);

const KNOWN = new Set([
  'meet', 'selectHanzi', 'selectMeaning', 'match', 'bankZh', 'bankEn', 'cloze',
  'listenWord', 'listenSent', 'tone',
]);
const AUDIO = new Set(['listenWord', 'listenSent', 'tone']);

// Is this exercise playable: right type, enough options, and an answer the
// learner can actually give?
function faults(ex, where) {
  const out = [];
  const bad = (msg) => out.push(`${where}: ${msg}`);
  if (!KNOWN.has(ex.type)) bad(`type ${ex.type}`);
  if (ex.options && ex.options.length < 2) bad(`${ex.type} thin options`);
  if (ex.type === 'selectHanzi' || ex.type === 'selectMeaning' || ex.type === 'listenWord') {
    if (!ex.options.some((o) => o.id === ex.answer)) bad(`${ex.type} has no right answer`);
  }
  if (ex.type === 'cloze' && !ex.options.includes(ex.answer)) {
    bad('cloze has no right answer');
  }
  if (AUDIO.has(ex.type)) {
    if (!ex.audio || !ex.say || !ex.fallback) bad(`${ex.type} lacks a sound or a pinyin fallback`);
  }
  if (ex.type === 'tone') {
    const w = ex.word;
    if (ex.options.length !== 5 || !ex.options.some((o) => o.tone === ex.answer)) {
      bad('tone has no right answer');
    }
    if (ex.answer !== w.tones[ex.at]) bad(`tone asks ${ex.answer} for ${w.word}[${ex.at}]`);
    // never a syllable whose spoken tone differs from the written one
    if (w.tones[ex.at] === 3 && w.tones[ex.at + 1] === 3) bad(`tone asks a sandhi third in ${w.word}`);
    if (w.tones.length > 1 && ['不', '一'].includes([...w.word][ex.at])) {
      bad(`tone asks ${[...w.word][ex.at]} inside ${w.word}`);
    }
    if (/[\u0304\u0301\u030c\u0300]/.test(ex.fallback.normalize('NFD'))) bad('tone fallback gives the tone away');
  }
  if (ex.type === 'bankZh' || ex.type === 'bankEn' || ex.type === 'listenSent') {
    const bank = [...ex.tiles];
    const buildable = ex.answer.every((t) => {
      const i = bank.indexOf(t);
      if (i < 0) return false;
      bank.splice(i, 1);
      return true;
    });
    if (!buildable) bad(`${ex.type} answer not in the tiles`);
    if (!E.checkBank(ex, ex.answer)) bad(`${ex.type} rejects its own answer`);
  }
  if (ex.type === 'match' && new Set(ex.left.map((w) => w.id)).size !== ex.left.length) {
    bad('match repeats a word');
  }
  return out;
}

// Every level of every unit, checked for playability and the type cap. Run
// once in silence and again with a voice, since the generator has two shapes.
function generationFaults() {
  const out = [];
  for (const u of readyUnits) {
    for (let level = 1; level <= u.levels; level++) {
      const items = E.buildLesson(u, level);
      if (items.length !== E.LESSON_SIZE) {
        out.push(`${u.id} L${level}: ${items.length} items`);
        continue;
      }
      for (const ex of items) out.push(...faults(ex, `${u.id} L${level}`));
      const counts = {};
      for (const ex of items) counts[ex.type] = (counts[ex.type] ?? 0) + 1;
      for (const [type, n] of Object.entries(counts)) {
        if (type !== 'meet' && n > 4) out.push(`${u.id} L${level}: ${n}x ${type}`);
      }
    }
  }
  return out;
}
const genFail = generationFaults();
check(`lessons generate for all ${readyUnits.length} units at every level`,
  genFail.length === 0, genFail.slice(0, 5).join('; '));

// Every exercise a run of the generator can produce, for looking at what a
// mode contains rather than whether it is playable.
function everyExercise(opts = {}) {
  const out = [];
  for (const u of readyUnits) {
    for (let level = 1; level <= u.levels; level++) out.push(...E.buildLesson(u, level, opts));
  }
  return out;
}
check('a silent lesson never asks for sound',
  !everyExercise().some((ex) => AUDIO.has(ex.type)) &&
  !everyExercise({ hard: true }).some((ex) => AUDIO.has(ex.type)));

// 20a. the batches a unit teaches line up with its word list and level count
const schedFail = [];
for (const u of readyUnits) {
  const flat = (u.intro ?? []).flat();
  if (flat.join('|') !== u.words.join('|')) schedFail.push(`${u.id}: intro != words`);
  if (u.intro.some((b) => b.length > co.introCap)) schedFail.push(`${u.id}: batch over cap`);
  if (u.levels !== u.intro.length + co.reviewLevels) {
    schedFail.push(`${u.id}: ${u.levels} levels, ${u.intro.length} batches`);
  }
}
check('teaching batches cover every word exactly once, in order',
  schedFail.length === 0, schedFail.slice(0, 4).join('; '));

// 20b. a generated lesson is teachable, not merely playable: every word it
//      introduces comes back inside it, soon and then later, recognised before
//      it is produced, and nothing shows up before it has been introduced.
//      See docs/duolingo-teaching-pattern.md section 5.8.
const MIN_RETRIEVALS = 3;
const NEAR_MAX = 4;
const FAR = 5;
const RUNS = 40;

// Which words an exercise makes the learner actively retrieve, and whether
// that retrieval is a production. Reading a word inside a bankEn prompt is
// not a retrieval of it.
function retrieved(ex) {
  const w = (t) => `w:${t}`;
  if (ex.type === 'selectHanzi' || ex.type === 'selectMeaning') {
    return { ids: [ex.word.id], produced: false };
  }
  if (ex.type === 'match') return { ids: ex.left.map((x) => x.id), produced: false };
  if (ex.type === 'cloze') return { ids: [w(ex.answer)], produced: true };
  if (ex.type === 'bankZh') return { ids: ex.sentence.tokens.map(w), produced: true };
  // Hearing a word and picking it is recognition, by ear instead of by
  // pinyin. Naming a tone is not a retrieval of the word.
  if (ex.type === 'listenWord') return { ids: [ex.word.id], produced: false };
  if (ex.type === 'listenSent') return { ids: ex.sentence.tokens.map(w), produced: false };
  return { ids: [], produced: false };
}

// Every course word an exercise puts on screen at all, retrieved or just read.
function shown(ex) {
  const w = (t) => `w:${t}`;
  if (ex.type === 'meet') return [ex.word.id];
  if (ex.type === 'selectHanzi' || ex.type === 'selectMeaning') {
    return ex.options.map((o) => o.id);
  }
  if (ex.type === 'match') return [...ex.left, ...ex.right].map((x) => x.id);
  if (ex.type === 'bankZh' || ex.type === 'listenSent') return ex.tiles.map(w);
  if (ex.type === 'cloze') return [...ex.sentence.tokens.map(w), ...ex.options.map(w)];
  if (ex.type === 'bankEn') return ex.sentence.tokens.map(w);
  if (ex.type === 'listenWord') return ex.options.map((o) => o.id);
  if (ex.type === 'tone') return [ex.word.id];
  return [];
}

function teachingFaults() {
  const teachFail = [];
  const bump = (msg) => {
    if (!teachFail.includes(msg)) teachFail.push(msg);
  };

  for (const u of readyUnits) {
    const earlier = [];
    for (const x of readyUnits) {
      if (x.id === u.id) break;
      earlier.push(...x.words);
    }
    for (let level = 1; level <= u.levels; level++) {
      const batch = u.intro[level - 1] ?? [];
      const taught = new Set([...earlier, ...u.intro.slice(0, level).flat()]);
      for (let run = 0; run < RUNS; run++) {
        mem.clear();
        const items = E.buildLesson(u, level);
        const where = `${u.id} L${level}`;
        const intros = items.filter((ex) => ex.type === 'meet').map((ex) => ex.word.id);
        if (intros.join('|') !== batch.join('|')) bump(`${where}: introduces ${intros.length}, expected ${batch.length}`);

        // nothing on screen before it has been taught, and nothing from this
        // lesson's batch before its own introduction
        const introAt = new Map(
          items.map((ex, i) => [ex.type === 'meet' ? ex.word.id : null, i]).filter(([id]) => id)
        );
        items.forEach((ex, i) => {
          for (const id of shown(ex)) {
            if (!C.word(id)) continue;
            if (!taught.has(id)) bump(`${where}: ${id} shown but not taught`);
            else if (introAt.has(id) && i < introAt.get(id)) {
              bump(`${where}: ${id} shown at ${i}, introduced at ${introAt.get(id)}`);
            }
          }
        });

        // per introduced word: enough retrievals, near one, far one, and no
        // production before a recognition
        for (const id of batch) {
          const at = introAt.get(id);
          const hits = [];
          let firstProduced = -1;
          let firstRecognised = -1;
          items.forEach((ex, i) => {
            const r = retrieved(ex);
            if (i <= at || !r.ids.includes(id)) return;
            hits.push(i);
            if (r.produced && firstProduced < 0) firstProduced = i;
            if (!r.produced && firstRecognised < 0) firstRecognised = i;
          });
          if (hits.length < MIN_RETRIEVALS) bump(`${where}: ${id} retrieved ${hits.length}x`);
          if (!hits.length) continue;
          if (hits[0] - at > NEAR_MAX) bump(`${where}: ${id} first retrieval at lag ${hits[0] - at}`);
          if (hits[0] - at < 2) bump(`${where}: ${id} retrieved in the very next slot`);
          if (!hits.some((i) => i - at >= FAR)) bump(`${where}: ${id} has no retrieval at lag ${FAR}+`);
          if (firstProduced >= 0 && (firstRecognised < 0 || firstProduced < firstRecognised)) {
            bump(`${where}: ${id} produced before it was recognised`);
          }
        }
      }
    }
  }
  return teachFail;
}
const teachFail = teachingFaults();
check(`every taught word is drilled ${MIN_RETRIEVALS}x in the lesson that teaches it`,
  teachFail.length === 0, teachFail.slice(0, 5).join('; '));

// 20c. a hint costs a grade, the way it already does on the writing cards
const L = await import('../js/lesson.js');
check('a clean answer is Good', L.ratingFor(0, false) === Rating.Good);
check('a hinted answer is Hard', L.ratingFor(0, true) === Rating.Hard);
check('one slip is Hard', L.ratingFor(1, false) === Rating.Hard);
check('a hinted slip is Again', L.ratingFor(1, true) === Rating.Again);
check('two slips are Again', L.ratingFor(2, false) === Rating.Again);

// 20d. a hard replay is a full lesson with no introductions, leaning on
//      production, with more to choose between than the level it replays
const hardFail = [];
let hardProduction = 0;
let hardSlots = 0;
for (const u of readyUnits) {
  const items = E.buildLesson(u, u.levels, { hard: true });
  if (items.length !== E.LESSON_SIZE) hardFail.push(`${u.id}: ${items.length} items`);
  for (const ex of items) hardFail.push(...faults(ex, `${u.id} hard`));
  if (items.some((ex) => ex.type === 'meet')) hardFail.push(`${u.id}: introduces a word`);
  hardSlots += items.length;
  hardProduction += items.filter((ex) => ['bankZh', 'bankEn', 'cloze'].includes(ex.type)).length;
}
check(`a hard replay generates for all ${readyUnits.length} units`, hardFail.length === 0,
  hardFail.slice(0, 5).join('; '));
check('a hard replay is mostly production', hardProduction >= hardSlots * 0.5,
  `${hardProduction} of ${hardSlots}`);

const lastUnit = readyUnits[readyUnits.length - 1];
const widest = (type, opts) =>
  Math.max(0, ...E.buildLesson(lastUnit, lastUnit.levels, opts)
    .filter((ex) => ex.type === type)
    .map((ex) => (ex.tiles ?? ex.options).length - (ex.answer.length ?? 1)));
check('a hard replay puts more tiles on the board',
  widest('bankZh', { hard: true }) > widest('bankZh', {}) &&
  widest('selectHanzi', { hard: true }) > widest('selectHanzi', {}),
  `${widest('bankZh', { hard: true })} spare tiles vs ${widest('bankZh', {})}`);
check('the hard flag does not leak into the next lesson',
  widest('bankZh', {}) <= 3);

// 21. the writing track: locked until a lesson is played, then one unit at a
//     time, in track order, with whole words only once their characters are up
S.eraseAll();
const W = await import('../js/writing.js');
await W.loadDeck(c);

check('writing is locked until a lesson is played', W.track().length === 0);

const firstUnit = readyUnits[0];
S.completeLevel(firstUnit.id, firstUnit.levels);
check('a played unit unlocks exactly its own writing track',
  W.track().join('') === firstUnit.writing.join(''));
check('the next characters follow track order',
  W.newChars(3).map((i) => i.id).join('') === firstUnit.writing.slice(0, 3).join(''));
check('a character with no word of its own is a building block',
  W.newChars(3).every((i) => i.type === (co.chars[i.id].block ? 'block' : 'char')));
check('the old deck is still a source of writable characters',
  W.writable('谢') && W.writable(c.cards[0].char));

const pair = firstUnit.words.map((id) => co.words[id]).find((w) => w.chars.length > 1);
check('no word is offered before its characters are started',
  W.wordItems().length === 0, pair.word);
for (const ch of pair.chars) S.start(ch, 'w');
const offered = W.wordItems();
check('a word is offered once every character in it is started',
  offered.some((i) => i.id === pair.id && i.type === 'word'),
  offered.map((i) => i.id).join(' '));
check('the day\'s new-character budget still caps the queue',
  W.newChars(0).length === 0);
check('progress counts what the track has opened up',
  W.trackProgress().unlocked === firstUnit.writing.length &&
  W.trackProgress().locked > 0);

// 22. a practice set is playable: one exercise per due item, and every
//     exercise it makes is answerable
const practiceItems = [
  ...readyUnits[0].words.map((id) => ({ id, kind: 'r' })),
  ...readyUnits[0].sentences.map((id) => ({ id, kind: 'b' })),
];
const set = E.buildPractice(practiceItems);
check('a practice set covers the due items',
  set.length === Math.min(E.LESSON_SIZE, practiceItems.length), `${set.length} items`);
const prFail = set.flatMap((ex) => faults(ex, 'practice'));
check('every practice exercise is answerable', prFail.length === 0,
  prFail.slice(0, 5).join('; '));
check('a practice set ignores items the course has dropped',
  E.buildPractice([{ id: 'w:nope', kind: 'r' }, { id: 's:nope', kind: 'b' }]).length === 0);

// 23. a word bank must not accept the wrong order
const anySentence = Object.values(co.sentences).find((s) => s.tokens.length > 2);
const bankEx = { accepted: [anySentence.tokens] };
check('word bank rejects a scrambled answer',
  !E.checkBank(bankEx, [...anySentence.tokens].reverse()) ||
  anySentence.tokens.join() === [...anySentence.tokens].reverse().join());

// 24. the streak forgives one missed day and then gives up
mem.clear();
const S2 = await import('../js/store.js');
check('a fresh store has no streak', S2.streakDays() === 0);
S2.store.course.streak = { n: 5, last: S2.dayOffset(-1), freeze: 1 };
check('yesterday keeps the streak alive', S2.streakDays() === 5);
S2.store.course.streak = { n: 5, last: S2.dayOffset(-3), freeze: 1 };
check('a three-day gap drops the streak', S2.streakDays() === 0);
S2.store.course.streak = { n: 5, last: S2.dayOffset(-2), freeze: 1 };
S2.addXp(10);
check('a freeze covers one missed day', S2.store.course.streak.n === 6 &&
  S2.store.course.streak.freeze === 0);
S2.store.course.streak = { n: 6, last: S2.dayOffset(-2), freeze: 0 };
S2.addXp(10);
check('without a freeze the streak restarts', S2.store.course.streak.n === 1);

// ── sound ─────────────────────────────────────────────────────────────

process.stdout.write('\nsound\n');

// 26. the audio layer reads the system voices lazily, so a stub dropped in
//     here turns the generator's second shape on for the rest of the run
const A = await import('../js/audio.js');
check('without a voice nothing is available', !A.available() && A.speak('你好') === false);
check('a listening card is dropped from practice in silence',
  E.buildPractice([{ id: readyUnits[0].words[0], kind: 'l' }]).length === 0);

const spoken = [];
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
globalThis.speechSynthesis = {
  getVoices: () => [
    { name: 'Sin-ji', lang: 'zh-HK', default: false },
    { name: 'Mei-Jia', lang: 'zh-TW', default: false },
    { name: 'Ting-Ting', lang: 'zh_CN', default: true },
    { name: 'Samantha', lang: 'en-US', default: true },
  ],
  cancel: () => spoken.push(null),
  speak: (u) => spoken.push(u),
};
check('Mandarin voices are found, mainland first, Cantonese left out',
  A.voices().map((v) => v.name).join(' ') === 'Ting-Ting Mei-Jia');
check('speaking cancels what was playing and uses the Mandarin voice',
  A.speak('你好') === true && spoken[0] === null && spoken[1].text === '你好' &&
  spoken[1].voice.name === 'Ting-Ting');
check('pinyin helpers read, strip and write tone marks',
  A.toneOf('hǎo') === 3 && A.toneOf('ma') === 0 && A.bare('nǚ') === 'nü' &&
  A.mark('hao', 4) === 'hào' && A.mark('xie', 2) === 'xié' && A.mark('gou', 3) === 'gǒu' &&
  A.mark('lü', 3) === 'lǚ' && A.mark('ma', 0) === 'ma');

// with a voice, every level still generates and still teaches -- and now
// some of it is heard
const heardGen = generationFaults();
check('lessons still generate for every level with a voice',
  heardGen.length === 0, heardGen.slice(0, 5).join('; '));
const heardTeach = teachingFaults();
check('a lesson with a voice still drills every taught word',
  heardTeach.length === 0, heardTeach.slice(0, 5).join('; '));

const heard = everyExercise();
const heardTypes = new Set(heard.filter((ex) => AUDIO.has(ex.type)).map((ex) => ex.type));
check('a lesson with a voice asks by ear',
  ['listenWord', 'listenSent', 'tone'].every((t) => heardTypes.has(t)),
  [...heardTypes].join(' '));
const heardHard = readyUnits.flatMap((u) => E.buildLesson(u, u.levels, { hard: true }));
check('a hard replay with a voice asks by ear too',
  heardHard.some((ex) => AUDIO.has(ex.type)) && heardHard.every((ex) => !faults(ex, 'hard').length));
check('an audio exercise grades the listening card',
  heard.filter((ex) => AUDIO.has(ex.type)).every((ex) =>
    (ex.keys ?? [ex.key]).every((k) => k.endsWith(':l') && k.startsWith('w:'))));

// a listening practice set rotates through the three ways of hearing a word
const listenSet = E.buildPractice(readyUnits[0].words.map((id) => ({ id, kind: 'l' })));
check('a listening practice set is answerable and all by ear',
  listenSet.length === readyUnits[0].words.length &&
  listenSet.every((ex) => AUDIO.has(ex.type) && !faults(ex, 'listening').length),
  listenSet.map((ex) => ex.type).join(' '));
check('a listening set hears words and sentences and names tones',
  new Set(listenSet.map((ex) => ex.type)).size === 3, listenSet.map((ex) => ex.type).join(' '));

// tone questions never land on a syllable the voice says differently
const toneExs = [...heard, ...heardHard, ...listenSet].filter((ex) => ex.type === 'tone');
check('no tone question is asked of 你 in 你好',
  toneExs.length > 0 && !toneExs.some((ex) => ex.word.word === '你好' && ex.at === 0));
check('a tone question about a two-syllable word marks which syllable',
  toneExs.filter((ex) => ex.word.tones.length > 1).every((ex) => ex.at < ex.word.tones.length));

// ── offline ───────────────────────────────────────────────────────────

process.stdout.write('\noffline\n');

// 25. the service worker precaches every file the shell is made of, and
//     nothing it lists is missing from disk
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const shell = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]).filter((f) => f !== './');
const shellMissing = shell.filter((f) => !fs.existsSync(path.join(ROOT, f)));
check('every precached file exists', shellMissing.length === 0, shellMissing.join(' '));

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const referenced = new Set([
  'index.html', 'app.css', 'app.js', 'data/course.json', 'data/curriculum.json',
  ...fs.readdirSync(path.join(ROOT, 'js')).map((f) => `js/${f}`),
  ...fs.readdirSync(path.join(ROOT, 'vendor')).filter((f) => !f.endsWith('LICENSE')).map((f) => `vendor/${f}`),
  ...[...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]).filter((f) => !/^https?:/.test(f)),
]);
const unlisted = [...referenced].filter((f) => !shell.includes(f));
check('every shell file is precached', unlisted.length === 0, unlisted.join(' '));
check('the worker reads unit bundles off the course',
  sw.includes("data/units/${u.id}.json") && !/data\/units\/b\d/.test(sw));

process.stdout.write(failures ? `\n${failures} failing\n` : '\nall checks pass\n');
process.exit(failures ? 1 : 0);
