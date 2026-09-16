#!/usr/bin/env node
/**
 * Builds data/course.json and data/units/<unitId>.json from the textbook spine.
 *
 * The spine files under tools/spine hold the facts we take from the HSK
 * Standard Course: lesson order, lesson topic, and which words and grammar
 * points each lesson introduces. Everything else — pinyin, meanings, HSK
 * bands, frequency, character decomposition, stroke outlines — is resolved
 * here from the open datasets already cached in tools/cache.
 *
 * Sources:
 *   - tools/spine/book-N.json             (our transcription of lesson facts)
 *   - drkameleon/complete-hsk-vocabulary  (bands, pinyin, meanings, frequency)
 *   - skishore/makemeahanzi               (IDS decomposition, glosses, hints)
 *   - hanzi-writer-data (npm)             (stroke outlines + medians)
 *   - tools/cache/asg-hsksc-citations.json (grammar point -> book/page, from
 *     the AllSet Learning Chinese Grammar Wiki, CC BY-NC-SA 3.0)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools', 'cache');
const SPINE = path.join(ROOT, 'tools', 'spine');
const DATA = path.join(ROOT, 'data');
// The scanned course books. Gitignored (copyrighted), so a fork checked out
// without them builds a course with no PDF pointers and the app hides the
// viewer and its access-phrase setting.
const PRIVATE = path.join(ROOT, 'docs', 'private');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

// How many words one teaching lesson introduces, and how many pure-review
// levels follow the teaching levels. A unit's level count falls out of its
// word count rather than being the same for every unit -- see
// docs/duolingo-teaching-pattern.md section 5.2.
const INTRO_CAP = Number(args.introCap ?? 3);
const REVIEW_LEVELS = Number(args.reviewLevels ?? 2);
const strict = args.strict === true || args.strict === 'true';

const CJK = /[一-鿿]/;
const IDC = /[⿰-⿻]/g;

// A unit's words, chunked into the batches its teaching levels introduce.
// Level N teaches batch N-1; levels past the last batch are review.
const introBatches = (ids) => {
  const out = [];
  for (let i = 0; i < ids.length; i += INTRO_CAP) out.push(ids.slice(i, i + INTRO_CAP));
  // A teaching level cannot space the retrieval of a word it introduces alone,
  // so a trailing batch of one word is avoided by rebalancing the last two
  // batches (…3,1 -> …2,2), keeping every batch within the cap and above one.
  const n = out.length;
  if (n > 1 && out[n - 1].length === 1) {
    out[n - 1].unshift(out[n - 2].pop());
  }
  return out;
};

const warnings = [];
const warn = (msg) => warnings.push(msg);

// --- sources ------------------------------------------------------------

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const hsk = readJson(path.join(CACHE, 'hsk-complete.json'));

const mmah = new Map();
for (const line of fs
  .readFileSync(path.join(CACHE, 'makemeahanzi-dictionary.txt'), 'utf8')
  .split('\n')
  .filter(Boolean)) {
  const e = JSON.parse(line);
  mmah.set(e.character, e);
}

const citations = fs.existsSync(path.join(CACHE, 'asg-hsksc-citations.json'))
  ? readJson(path.join(CACHE, 'asg-hsksc-citations.json'))
  : [];
const citationById = new Map(citations.map((c) => [c.id, c]));

function strokeDataDir() {
  const local = path.join(CACHE, 'hanzi-writer-data');
  if (fs.existsSync(local)) return local;
  const dep = path.join(ROOT, 'node_modules', 'hanzi-writer-data');
  if (fs.existsSync(dep)) return dep;
  throw new Error('stroke data missing. run: npm install hanzi-writer-data');
}
const STROKES = strokeDataDir();
const strokeFile = (ch) => path.join(STROKES, `${ch}.json`);
const hasStrokes = (ch) => fs.existsSync(strokeFile(ch));

const strokeCache = new Map();
function strokeData(ch) {
  if (!strokeCache.has(ch)) strokeCache.set(ch, readJson(strokeFile(ch)));
  return strokeCache.get(ch);
}
const strokeCount = (ch) => strokeData(ch).strokes?.length ?? 99;

// The existing handwriting curriculum is already sorted so that no character
// arrives before its components. Reuse that global order as the tie-breaker
// for the writing track, so the two tracks never disagree about which of two
// characters is the simpler one to write first.
const writeOrder = new Map();
const curriculumFile = path.join(DATA, 'curriculum.json');
if (fs.existsSync(curriculumFile)) {
  for (const c of readJson(curriculumFile).cards) writeOrder.set(c.char, c.i);
}

// --- HSK vocabulary index ----------------------------------------------

const bandsOf = (entry, prefix) =>
  entry.level
    .filter((l) => l.startsWith(prefix))
    .map((l) => Number(l.slice(prefix.length)))
    .filter(Number.isFinite);

const hskByWord = new Map();
for (const entry of hsk) {
  if (!hskByWord.has(entry.simplified)) hskByWord.set(entry.simplified, entry);
}

const TONE_MARKS = {
  1: 'āēīōūǖĀĒĪŌŪǕ',
  2: 'áéíóúǘÁÉÍÓÚǗ',
  3: 'ǎěǐǒǔǚǍĚǏǑǓǙ',
  4: 'àèìòùǜÀÈÌÒÙǛ',
};

// Tone of each syllable in a marked-pinyin string. A syllable with no marked
// vowel is neutral (0) — 名字 is míng zi, second tone then neutral.
function tonesOf(pinyin) {
  return pinyin
    .split(/[\s'·]+/)
    .filter(Boolean)
    .map((syl) => {
      for (const [tone, marks] of Object.entries(TONE_MARKS)) {
        if ([...syl].some((ch) => marks.includes(ch))) return Number(tone);
      }
      return 0;
    });
}

function resolveWord(spec) {
  const entry = hskByWord.get(spec.word);
  const form = entry?.forms?.[0];
  const pinyin = spec.pinyin ?? form?.transcriptions?.pinyin ?? '';
  if (!entry && !spec.pinyin) {
    warn(`word not in the HSK dataset and no spine pinyin: ${spec.word}`);
  }
  if (!pinyin) warn(`no pinyin for ${spec.word}`);
  // A multi-syllable pinyin override needs a break between syllables (space, '
  // or ·) or tonesOf() reads the whole thing as one syllable and drops all but
  // one tone — 'Měiguó' must be 'Měi guó'.
  const cjkLen = [...spec.word].filter((c) => CJK.test(c)).length;
  if (spec.pinyin && cjkLen > 1 && !/[\s'·]/.test(spec.pinyin.trim())) {
    warn(`pinyin override "${spec.pinyin}" for ${spec.word} has no syllable break — tones will be wrong`);
  }
  // The gloss comes from the spine, not the dataset: taking the dataset's
  // first meaning gives a character its dictionary-headword sense rather than
  // the sense the lesson teaches (也 as "surname Ye", for one).
  const meaning = spec.gloss ?? (form?.meanings ?? [])[0] ?? '';
  if (!spec.gloss) warn(`no lesson gloss for ${spec.word}, fell back to the dataset meaning`);
  return {
    id: `w:${spec.word}`,
    word: spec.word,
    pinyin,
    tones: tonesOf(pinyin),
    meaning,
    pos: entry?.pos ?? [],
    chars: [...spec.word].filter((c) => CJK.test(c)),
    hsk2: bandsOf(entry ?? { level: [] }, 'old-')[0] ?? null,
    hsk3: bandsOf(entry ?? { level: [] }, 'new-')[0] ?? null,
    freq: entry?.frequency ?? null,
  };
}

// --- character cards ----------------------------------------------------

function componentsOf(ids) {
  if (!ids) return [];
  return [...ids.replace(IDC, '')].filter((c) => c !== '？' && CJK.test(c));
}

// A writing card needs a sound and a gloss of its own, and a component that
// only ever turns up inside other characters has neither in the word list.
// Make Me a Hanzi covers those; the lesson gloss wins wherever there is one.
const shortGloss = (text) =>
  text
    ? text
        .split(/[;\/]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join('; ')
    : null;

// Make Me a Hanzi first, because the vocabulary dataset's headword for a bare
// character can be a surname reading — 也 comes back as "Ye", not "yě".
function charPinyin(ch) {
  const entry = hskByWord.get(ch);
  return (
    mmah.get(ch)?.pinyin?.[0] ??
    entry?.forms?.[0]?.transcriptions?.pinyin ??
    null
  );
}

function charCard(ch, knownBefore) {
  const m = mmah.get(ch);
  const parts = [];
  const seen = new Set();
  for (const p of componentsOf(m?.decomposition)) {
    if (p === ch || seen.has(p)) continue;
    seen.add(p);
    parts.push({
      char: p,
      pinyin: charPinyin(p),
      gloss: shortGloss(mmah.get(p)?.definition),
      known: knownBefore.has(p),
    });
  }
  return {
    char: ch,
    strokes: hasStrokes(ch) ? strokeCount(ch) : null,
    radical: m?.radical ?? null,
    hint: m?.etymology?.hint ?? null,
    pinyin: charPinyin(ch),
    meaning: shortGloss(m?.definition),
    parts,
  };
}

// Two characters that could equally well come first in a unit are ordered the
// way the handwriting deck already orders them — global dependency order, then
// frequency and stroke count — so the two tracks never disagree about which of
// the pair is the simpler one to write. This only ever reorders siblings; the
// recursion below still emits every component before the character it builds.
const simplerFirst = (list) =>
  [...new Set(list)].sort(
    (a, b) =>
      (writeOrder.get(a) ?? Infinity) - (writeOrder.get(b) ?? Infinity) ||
      (hasStrokes(a) ? strokeCount(a) : 99) - (hasStrokes(b) ? strokeCount(b) : 99) ||
      a.localeCompare(b)
  );

// --- build --------------------------------------------------------------

const spineFiles = fs
  .readdirSync(SPINE)
  .filter((f) => /^book-\d+\.json$/.test(f))
  .sort();
if (!spineFiles.length) throw new Error(`no spine files in ${SPINE}`);

const words = {};
const grammar = {};
const sentences = {};
const chars = {};
const units = [];
const sections = [];
const unitStrokes = new Map(); // unitId -> { char: strokeData }

const taughtWords = new Set(); // word strings taught so far, cumulatively
const wordChars = new Set(); // characters that appear in a taught word
const knownChars = new Set(); // characters whose writing card has been placed
let verified = true;

const hasScan = (ref) => Boolean(ref?.file) && fs.existsSync(path.join(PRIVATE, ref.file));

for (const file of spineFiles) {
  const book = readJson(path.join(SPINE, file));
  if (book.verified !== true) verified = false;
  const sectionUnits = [];

  for (const lesson of book.lessons) {
    const id = `b${book.book}l${lesson.lesson}`;
    const wordIds = [];

    for (const spec of lesson.words) {
      const w = resolveWord(spec);
      if (words[w.id]) {
        warn(`${spec.word} is introduced twice (again in ${id})`);
        continue;
      }
      words[w.id] = w;
      wordIds.push(w.id);
      taughtWords.add(w.word);
      for (const ch of w.chars) wordChars.add(ch);
    }

    const grammarIds = [];
    for (const g of lesson.grammar) {
      if (grammar[g.id]) {
        warn(`duplicate grammar id ${g.id} (${id})`);
        continue;
      }
      const cite = g.wikiRef ? citationById.get(g.wikiRef) : null;
      grammar[g.id] = {
        id: g.id,
        title: g.title,
        pattern: g.pattern,
        tip: g.tip,
        unit: id,
        source: g.source ?? 'authored',
        wikiRef: g.wikiRef ?? null,
        wikiUrl: g.wikiRef
          ? `https://resources.allsetlearning.com/chinese/grammar/${g.wikiRef}`
          : null,
        page: g.page ?? cite?.page ?? null,
        examples: [],
      };
      grammarIds.push(g.id);
    }

    const sentenceIds = [];
    lesson.sentences.forEach((s, i) => {
      const sid = `s:${id}-${String(i + 1).padStart(2, '0')}`;
      const untaught = s.tokens.filter((t) => !taughtWords.has(t));
      if (untaught.length) {
        warn(`${sid} uses words not yet taught: ${untaught.join(' ')}`);
        if (strict) return;
      }
      const joined = s.tokens.join('');
      const stripped = s.zh.replace(/[，。！？、：；“”‘’]/g, '');
      if (joined !== stripped) {
        warn(`${sid} tokens ${joined} do not rebuild ${stripped}`);
      }
      sentences[sid] = {
        id: sid,
        unit: id,
        zh: s.zh,
        tokens: s.tokens,
        alt: s.alt ?? [],
        pinyin: s.pinyin,
        en: s.en,
        enTokens: s.enTokens ?? s.en.replace(/[.!?,]/g, '').split(/\s+/),
        enAlt: s.enAlt ?? [],
        grammar: s.grammar ?? [],
        credit: s.credit ?? null,
      };
      for (const gid of sentences[sid].grammar) {
        if (grammar[gid]) grammar[gid].examples.push(sid);
        else warn(`${sid} tags unknown grammar point ${gid}`);
      }
      sentenceIds.push(sid);
    });

    // Writing track: the unit's new characters, plus any component they are
    // built from that has stroke data but never appears as a word of its own.
    // Those components become short "building block" cards. Everything is
    // ordered so a character never arrives before its parts.
    const fresh = [];
    const place = (ch) => {
      if (!CJK.test(ch) || knownChars.has(ch) || fresh.includes(ch)) return false;
      if (!hasStrokes(ch)) {
        warn(`no stroke data for ${ch}, left out of the writing track`);
        return false;
      }
      fresh.push(ch);
      return true;
    };
    // A single-stroke component is a stroke, not a character worth a card of
    // its own — unless it is a word in its own right (一, 人).
    const worthACard = (ch) =>
      hasStrokes(ch) && (strokeCount(ch) > 1 || hskByWord.has(ch));

    // A block card needs both a reading and a gloss of its own (check 15), so a
    // component that is missing either is a graphical fragment, not a block worth
    // a card: 龶, which has neither and exists only inside 青, and 氺, which has a
    // reading but no meaning and exists only inside 求/泰. The character that
    // contains such a fragment is traced whole instead of descending into it.
    const teachable = (ch) => {
      const m = mmah.get(ch);
      return Boolean(m && m.pinyin?.length && m.definition);
    };

    // Every component is followed down, because a block you are asked to
    // trace should itself be built out of blocks you have already traced.
    // Without that, 吗 puts 口 on the page in this unit while 口's own piece
    // 冂 does not turn up until two units later.
    const collect = (ch, guard = new Set()) => {
      if (guard.has(ch) || knownChars.has(ch) || fresh.includes(ch)) return;
      guard.add(ch);
      for (const p of simplerFirst(
        componentsOf(mmah.get(ch)?.decomposition).filter(
          (p) => p !== ch && worthACard(p) && teachable(p)
        )
      )) {
        collect(p, guard);
      }
      place(ch);
    };
    // A conversation-track book (e.g. the Cantonese Ving Tsun vocabulary) is
    // for recognition and speaking, not handwriting, so its units carry no
    // writing cards at all.
    const conversation =
      book.track === 'conversation' || lesson.track === 'conversation';
    if (!conversation) {
      for (const ch of simplerFirst(wordIds.flatMap((wid) => words[wid].chars))) {
        collect(ch);
      }
    }

    const writing = [];
    for (const ch of fresh) {
      chars[ch] = { ...charCard(ch, knownChars), unit: id };
      knownChars.add(ch);
      writing.push(ch);
    }
    if (writing.length) {
      unitStrokes.set(id, Object.fromEntries(writing.map((ch) => [ch, strokeData(ch)])));
    }

    // Textbook and workbook PDF pointers, when the book registers them in its
    // spine. The stored page is the physical PDF page -- the printed lesson
    // page shifted by the book's front-matter offset -- so a viewer opened at
    // #page= lands on the lesson. A conversation-track book (the Ving Tsun
    // vocabulary) has no scanned course book, so it gets none, and a book
    // whose scan is not on disk gets none either.
    const pdf = {};
    if (hasScan(book.pdf?.textbook) && lesson.page != null) {
      pdf.textbook = {
        slug: book.pdf.textbook.slug,
        page: lesson.page + (book.pdf.textbook.pageOffset ?? 0),
      };
    }
    if (hasScan(book.pdf?.workbook) && lesson.wbPage != null) {
      pdf.workbook = {
        slug: book.pdf.workbook.slug,
        page: lesson.wbPage + (book.pdf.workbook.pageOffset ?? 0),
      };
    }

    units.push({
      id,
      book: book.book,
      lesson: lesson.lesson,
      title: lesson.title,
      titlePinyin: lesson.titlePinyin,
      titleEn: lesson.titleEn,
      topic: lesson.topic,
      textbook: `Book ${book.book}, Lesson ${lesson.lesson}`,
      page: lesson.page ?? null,
      pdf: Object.keys(pdf).length ? pdf : null,
      words: wordIds,
      intro: introBatches(wordIds),
      grammar: grammarIds,
      sentences: sentenceIds,
      writing,
      levels: wordIds.length ? introBatches(wordIds).length + REVIEW_LEVELS : 0,
      ready: wordIds.length > 0,
    });
    sectionUnits.push(id);
  }

  sections.push({
    n: book.book,
    title: book.title,
    publisher: book.publisher ?? null,
    verified: book.verified === true,
    units: sectionUnits,
  });
}

// --- character cards, finished off -------------------------------------

// A block is a character you only ever meet as a piece of another one. 谢 is
// not a block — 谢谢 is a word — but 射 and 讠 are, and a block gets the short
// "meet it, trace it, done" card instead of the full teaching flow. Which is
// which can only be known once every word in every book is in, so the gloss,
// the example words and the block flag are all settled here at the end.
const wordsByChar = new Map();
for (const w of Object.values(words)) {
  for (const ch of new Set(w.chars)) {
    if (!wordsByChar.has(ch)) wordsByChar.set(ch, []);
    wordsByChar.get(ch).push(w);
  }
}

for (const card of Object.values(chars)) {
  const uses = wordsByChar.get(card.char) ?? [];
  const asWord = words[`w:${card.char}`];
  card.block = uses.length === 0;
  if (asWord) {
    card.pinyin = asWord.pinyin;
    card.meaning = asWord.meaning;
  }
  if (!card.pinyin) warn(`no pinyin for the writing card ${card.char}`);
  if (!card.meaning) warn(`no gloss for the writing card ${card.char}`);
  card.examples = uses
    .filter((w) => w.word !== card.char)
    .slice(0, 3)
    .map((w) => ({ word: w.word, pinyin: w.pinyin, meaning: w.meaning }));
}

// --- write --------------------------------------------------------------

const course = {
  built: new Date().toISOString().slice(0, 10),
  spine: { name: 'HSK Standard Course', books: sections.map((s) => s.n), verified },
  introCap: INTRO_CAP,
  reviewLevels: REVIEW_LEVELS,
  sections,
  units,
  words,
  grammar,
  sentences,
  chars,
};

fs.mkdirSync(path.join(DATA, 'units'), { recursive: true });
fs.writeFileSync(path.join(DATA, 'course.json'), JSON.stringify(course));
for (const [id, bundle] of unitStrokes) {
  fs.writeFileSync(path.join(DATA, 'units', `${id}.json`), JSON.stringify(bundle));
}

const ready = units.filter((u) => u.ready);
process.stdout.write(
  `\n${sections.length} book(s), ${units.length} units (${ready.length} with content)\n` +
    `${Object.keys(words).length} words, ${Object.keys(grammar).length} grammar points, ` +
    `${Object.keys(sentences).length} sentences, ${Object.keys(chars).length} characters\n` +
    (verified ? '' : 'spine is NOT yet verified against the printed textbook\n')
);
if (warnings.length) {
  const shown = warnings.slice(0, 12);
  process.stdout.write(
    `\n${warnings.length} warning(s):\n` +
      shown.map((w) => `  - ${w}\n`).join('') +
      (warnings.length > shown.length ? `  ... and ${warnings.length - shown.length} more\n` : '')
  );
  // Under --strict every warning is a build failure, so a book import fails
  // loudly on a missing gloss or an untaught word rather than shipping it.
  if (strict) process.exit(1);
}
