import { keyOf, exposureOf, LIFETIME_TARGET } from './store.js';
import * as C from './course.js';
import * as audio from './audio.js';

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => shuffle([...a]).slice(0, n);

export const LESSON_SIZE = 15;
const TYPE_CAP = 4; // no exercise type may fill more than this many slots

// A hard replay is the same lesson shape with more to choose between: five
// wrong answers beside the right one instead of three, and five spare tiles in
// the word bank. The flag is module state because it is read deep inside the
// makers, and a lesson is built in one synchronous pass.
let hard = false;
const DISTRACTORS = () => (hard ? 5 : 3);
const EXTRA_TILES = () => (hard ? 5 : 3);

// Wrong answers should be plausible: a word of the same length and, where we
// can manage it, the same part of speech. Falling back through the whole
// taught pool keeps early units from running out of options.
function distractorWords(target, pool, n) {
  const others = pool.filter((id) => id !== target.id).map(C.word);
  const sameShape = others.filter(
    (w) =>
      w.chars.length === target.chars.length &&
      w.pos.some((p) => target.pos.includes(p))
  );
  const sameLength = others.filter((w) => w.chars.length === target.chars.length);
  const out = [];
  for (const tier of [sameShape, sameLength, others]) {
    for (const w of shuffle([...tier])) {
      if (out.length >= n) break;
      if (!out.some((x) => x.id === w.id)) out.push(w);
    }
    if (out.length >= n) break;
  }
  return out;
}

// Word-bank tiles: the answer's tokens plus a few near-misses, shuffled. The
// distractors are drawn from the taught pool so nothing unfamiliar appears.
function bankTiles(answer, pool, extra) {
  const inAnswer = new Set(answer);
  const spare = pool
    .map(C.word)
    .map((w) => w.word)
    .filter((t) => !inAnswer.has(t));
  return shuffle([...answer, ...sample(spare, Math.min(extra, spare.length))]);
}

function enBankTiles(answer, poolSentences, extra) {
  const inAnswer = new Set(answer.map((t) => t.toLowerCase()));
  const spare = [
    ...new Set(
      poolSentences
        .flatMap((id) => C.sentence(id).enTokens)
        .filter((t) => !inAnswer.has(t.toLowerCase()))
    ),
  ];
  return shuffle([...answer, ...sample(spare, Math.min(extra, spare.length))]);
}

// Card keys for the course words among a sentence's tokens. Punctuation and
// anything the course does not carry as a word simply drops out.
const wordKeysOf = (tokens) =>
  tokens
    .map((t) => C.word(`w:${t}`))
    .filter(Boolean)
    .map((w) => keyOf(w.id, 'r'));

// -- the exercise makers ------------------------------------------------

const makers = {
  // Meet a word: the word, its sound, its meaning and the characters it is
  // written with -- then one tap to pick its meaning out of two. Duolingo
  // introduces a character through an exercise with the answer on screen
  // rather than through a card that asks nothing, and a slot that asks
  // nothing is a slot that teaches nothing. The tap is deliberately trivial:
  // it does not count as a retrieval, and the card still starts the FSRS card
  // rather than grading it.
  meet: (w, pool) => {
    // The check needs one wrong meaning to sit beside the right one. It comes
    // from this lesson's own words, and the very first card of the course --
    // where nothing else is known yet -- simply goes without.
    const other = distractorWords(w, pool, 1);
    return {
      type: 'meet',
      key: keyOf(w.id, 'r'),
      word: w,
      chars: w.chars.map((ch) => C.course.chars[ch]).filter(Boolean),
      check: other.length ? shuffle([w, ...other]) : null,
      answer: w.id,
    };
  },

  selectHanzi: (w, pool) => ({
    type: 'selectHanzi',
    key: keyOf(w.id, 'r'),
    word: w,
    prompt: w.pinyin,
    hint: w.meaning,
    options: shuffle([w, ...distractorWords(w, pool, DISTRACTORS())]),
    answer: w.id,
  }),

  selectMeaning: (w, pool) => ({
    type: 'selectMeaning',
    key: keyOf(w.id, 'r'),
    word: w,
    prompt: w.word,
    options: shuffle([w, ...distractorWords(w, pool, DISTRACTORS())]),
    answer: w.id,
  }),

  match: (words, mode) => ({
    type: 'match',
    key: null,
    mode, // 'pinyin' or 'meaning'
    keys: words.map((w) => keyOf(w.id, 'r')),
    left: shuffle([...words]),
    right: shuffle([...words]),
    // A match covers four words; grading them off one counter marks all four
    // wrong for one mis-tapped pair. The miss is attributed to the left-hand
    // word the learner had selected -- the one they did not know.
    wrongBy: new Map(words.map((w) => [keyOf(w.id, 'r'), 0])),
  }),

  bankZh: (s, pool) => ({
    type: 'bankZh',
    key: keyOf(s.id, 'b'),
    sentence: s,
    prompt: s.en,
    answer: s.tokens,
    accepted: [s.tokens, ...s.alt],
    tiles: bankTiles(s.tokens, pool, EXTRA_TILES()),
    // The card graded is the sentence's, but the words are what the learner
    // had to retrieve, so exposure is counted over them.
    wordKeys: wordKeysOf(s.tokens),
  }),

  bankEn: (s, poolSentences) => ({
    type: 'bankEn',
    key: keyOf(s.id, 'b'),
    sentence: s,
    prompt: s.zh,
    answer: s.enTokens,
    accepted: [s.enTokens, ...s.enAlt],
    tiles: enBankTiles(s.enTokens, poolSentences, EXTRA_TILES()),
  }),

  // Fill the blank: hide one token of a sentence, preferring a token the
  // sentence's grammar point is actually about.
  cloze: (s, pool, want = null) => {
    const focus = s.grammar
      .map((gid) => C.grammar(gid))
      .filter(Boolean)
      .flatMap((g) => s.tokens.filter((t) => g.pattern.includes(t)));
    // A word-targeted production slot names the token it needs to test;
    // otherwise prefer a token the sentence's grammar point is about.
    const target =
      want && s.tokens.includes(want) ? want : focus.length ? pick(focus) : pick(s.tokens);
    const at = s.tokens.indexOf(target);
    const w = C.word(`w:${target}`);
    const options = w
      ? shuffle([w, ...distractorWords(w, pool, DISTRACTORS())]).map((x) => x.word)
      : shuffle([target, ...sample(s.tokens.filter((t) => t !== target), DISTRACTORS())]);
    return {
      type: 'cloze',
      key: keyOf(s.id, 'b'),
      sentence: s,
      at,
      answer: target,
      options,
      wordKeys: wordKeysOf([target]),
      tip: s.grammar.map((gid) => C.grammar(gid)).filter(Boolean)[0] ?? null,
    };
  },

  // -- the two types that need sound ------------------------------------
  //
  // Both grade the word's listening card, `word:l`: can the learner tell the
  // word by ear. They are built only when a Mandarin voice is available, and
  // every one of them carries `fallback`, the pinyin the runner shows when
  // the learner asks for it -- priced like a hint, because for a listening
  // exercise the pinyin is most of the answer.

  // Hear the word, pick the hanzi. The audio form of selectHanzi.
  listenWord: (w, pool) => ({
    type: 'listenWord',
    audio: true,
    key: keyOf(w.id, 'l'),
    word: w,
    say: w.word,
    fallback: w.pinyin,
    options: shuffle([w, ...distractorWords(w, pool, DISTRACTORS())]),
    answer: w.id,
  }),

  // Hear the sentence, build it from tiles. The words' listening cards are
  // graded; the words' reading is what was exercised, so exposure counts
  // there, the way it does for bankZh.
  listenSent: (s, pool) => ({
    type: 'listenSent',
    audio: true,
    key: null,
    keys: wordKeysOf(s.tokens).map((k) => k.replace(/:r$/, ':l')),
    sentence: s,
    say: s.zh,
    fallback: s.pinyin,
    answer: s.tokens,
    accepted: [s.tokens, ...s.alt],
    tiles: bankTiles(s.tokens, pool, EXTRA_TILES()),
    wordKeys: wordKeysOf(s.tokens),
  }),

  // Hear the word, name the tone of one of its syllables. The five tiles are
  // that syllable under each tone, so the learner reads the mark as they pick
  // it rather than translating "third" in their head. Null when the word has
  // no syllable whose written tone is what the voice will say.
  tone: (w) => {
    const targets = toneTargets(w);
    if (!targets.length) return null;
    const at = pick(targets);
    const syllable = w.pinyin.split(/\s+/)[at];
    return {
      type: 'tone',
      audio: true,
      key: keyOf(w.id, 'l'),
      word: w,
      at,
      say: w.word,
      fallback: w.pinyin.split(/\s+/).map(audio.bare).join(' '),
      options: TONES.map((t) => ({ tone: t, label: audio.mark(syllable, t) })),
      answer: w.tones[at],
    };
  },
};

const TONES = [1, 2, 3, 4, 0];

// Which syllables of a word are fair to ask the tone of: those the voice will
// say with the tone the dictionary writes. Tone sandhi breaks that in two
// places a beginner meets at once -- a third tone before another third tone
// is said as a second, and 不 and 一 change tone with what follows -- so
// those syllables are left out rather than marked wrong for hearing right.
function toneTargets(w) {
  const chars = [...w.word];
  return w.tones
    .map((t, i) => i)
    .filter((i) => !(w.tones[i] === 3 && w.tones[i + 1] === 3))
    .filter((i) => chars.length === 1 || !['不', '一'].includes(chars[i]));
}

// The types that cannot be built without a voice. A lesson generated in
// silence never contains them; one generated with a voice may.
const AUDIO_TYPES = new Set(['listenWord', 'listenSent', 'tone']);
const canHear = () => audio.available();

// -- the lesson recipe --------------------------------------------------

// A word introduced this lesson has to come back inside it, soon and then
// again later, and it has to be recognised before it is produced. The old
// generator walked a type cursor and handed each exercise whatever word came
// next, so both were accidents. This one schedules per word first and fills
// the leftovers by type. See docs/duolingo-teaching-pattern.md section 5.3.
const MIN_RETRIEVALS = 3; // active retrievals per new word, in its own lesson
const NEAR_MIN = 2; // never the very next slot: the answer is still on screen
const NEAR_MAX = 4; // but the first one lands inside this window
const FAR = 5; // and at least one at this lag or more

// Recognise it, recognise it the other way round, then produce it.
const LADDER = ['selectMeaning', 'selectHanzi', 'produce'];

// Fallback order per ladder step. Production never precedes a recognition, so
// steps 1 and 2 cannot fall through to it however tight the type caps get.
const FALLBACKS = {
  selectMeaning: ['selectMeaning', 'selectHanzi', 'match'],
  selectHanzi: ['selectHanzi', 'selectMeaning', 'match'],
  produce: ['produce', 'selectHanzi', 'selectMeaning', 'match'],
};

// Every word a level has taught by the time it is played: the earlier units in
// full, plus this unit's batches up to and including this level's.
function taughtBy(u, level) {
  const out = [];
  for (const x of C.readyUnits()) {
    if (x.id === u.id) break;
    out.push(...x.words);
  }
  out.push(...C.introBatches(u).slice(0, level).flat());
  return out;
}

// The review pool: everything taught before this level's batch, least
// practised first. FSRS says when a card is due; this says which of several
// equally eligible words to spend a slot on -- words still short of
// LIFETIME_TARGET retrievals come first, and within each group the least
// practised leads.
const shortOfTarget = (id) => (exposureOf(id, 'r') < LIFETIME_TARGET ? 0 : 1);

const byPractice = (a, b) =>
  shortOfTarget(a) - shortOfTarget(b) || exposureOf(a, 'r') - exposureOf(b, 'r');

function reviewPool(u, level) {
  const batch = new Set(C.introBatch(u, level));
  return taughtBy(u, level).filter((id) => !batch.has(id)).sort(byPractice);
}

// A sentence is playable at a level only if every course word in it has been
// taught by that level. Tokens that are not course words -- punctuation -- do
// not count against it. Without this a batched level 1 puts words it has not
// introduced yet on the tiles.
function playableSentences(u, level) {
  const known = new Set(taughtBy(u, level).map((id) => C.word(id)?.word));
  return C.sentencesThrough(u.id).filter((id) =>
    C.sentence(id).tokens.every((t) => !C.word(`w:${t}`) || known.has(t))
  );
}

// Which empty slots a newly introduced word gets: one close enough to the
// introduction to succeed but far enough to need retrieving -- never the very
// next slot, where the answer is still on screen and reading it is not
// retrieving it -- one late, and the rest wherever there is room. Sorted, so
// the ladder runs forwards.
function reserve(slots, at, n = MIN_RETRIEVALS) {
  const out = [];
  const free = (i) => slots[i] === null && !out.includes(i);

  for (let i = at + NEAR_MIN; i <= Math.min(at + NEAR_MAX, slots.length - 1); i++) {
    if (free(i)) {
      out.push(i);
      break;
    }
  }
  const far = [];
  for (let i = at + FAR; i < slots.length; i++) if (free(i)) far.push(i);
  if (far.length) out.push(far[Math.floor(far.length / 2)]);

  const rest = [];
  for (let i = at + 1; i < slots.length; i++) if (free(i)) rest.push(i);
  shuffle(rest);
  while (out.length < n && rest.length) out.push(rest.pop());

  return out.sort((a, b) => a - b);
}

// One retrieval of `w` at a given rung of the ladder, downgraded through
// FALLBACKS if the type it wants is capped or has no data behind it.
function retrieval(w, step, at, ctx) {
  const want = LADDER[Math.min(step, LADDER.length - 1)];
  // The sound-to-hanzi rung is played by ear half the time when there is a
  // voice to play it: the same recognition, without the pinyin as a crutch.
  const order =
    want === 'selectHanzi' && canHear() && Math.random() < 0.5
      ? ['listenWord', ...FALLBACKS[want]]
      : FALLBACKS[want];
  for (const type of order) {
    const ex = buildFor(type, w, at, ctx);
    if (ex && ctx.room(ex.type)) return ex;
  }
  return null;
}

function buildFor(type, w, at, ctx) {
  if (type === 'selectHanzi' || type === 'selectMeaning' || type === 'listenWord') {
    return makers[type](w, ctx.poolAt(at));
  }
  if (type === 'match') {
    const bag = ctx.wordsAt(at).filter((x) => x.id !== w.id);
    if (bag.length < 2) return null;
    return makers.match(
      shuffle([w, ...sample(bag, Math.min(3, bag.length))]),
      pick(['pinyin', 'meaning'])
    );
  }
  // Production: a sentence the learner can already read that uses this word.
  // Where none exists yet -- 你 and 好 in b1l1 level 1, whose only readable
  // sentence is the word 你好 -- another recognition beats a sentence built
  // out of words the level has not taught.
  const ids = ctx.sentencesAt(at).filter((id) => C.sentence(id).tokens.includes(w.word));
  if (!ids.length) return null;
  const s = C.sentence(pick(ids));
  if (s.tokens.length >= 3 && ctx.room('cloze')) {
    return makers.cloze(s, ctx.poolAt(at), w.word);
  }
  return makers.bankZh(s, ctx.poolAt(at));
}

export function buildLesson(u, level, opts = {}) {
  hard = Boolean(opts.hard);
  try {
    if (hard) return hardLesson(u);
    return C.isTeachLevel(u, level) ? teachLesson(u, level) : reviewLesson(u, level);
  } finally {
    hard = false;
  }
}

// A teaching level: introduce this level's batch, interleaved rather than
// blocked, and give every word of it a retrieval ladder inside the lesson.
function teachLesson(u, level) {
  const batch = C.introBatch(u, level).map(C.word).filter(Boolean);
  const slots = new Array(LESSON_SIZE).fill(null);
  const counts = {};
  const room = (type) => (counts[type] ?? 0) < TYPE_CAP;
  const put = (i, ex) => {
    if (!ex) return false;
    slots[i] = ex;
    counts[ex.type] = (counts[ex.type] ?? 0) + 1;
    return true;
  };

  const review = reviewPool(u, level).map(C.word).filter(Boolean);
  const sentences = playableSentences(u, level);

  // Introductions spread out, so the learner never meets three words in a row
  // before being asked about any of them. The first two are adjacent because
  // after meeting a single word there is nothing to drill it against -- no
  // distractor, no pair, no sentence.
  const introAt = new Map();
  batch.forEach((w, i) =>
    introAt.set(w.id, Math.min(i === 0 ? 0 : i * 2 - 1, LESSON_SIZE - 1))
  );

  // What an exercise in slot `i` is allowed to use: everything taught before
  // this lesson, plus the words this lesson has introduced by that point. A
  // word met in slot 4 has no business on the tiles in slot 1.
  const wordsAt = (i) => [
    ...review,
    ...batch.filter((w) => introAt.get(w.id) < i),
  ];
  // Distractor tiles and spare word-bank tiles come from here, so an early
  // level cannot offer a word it has not taught as a wrong answer. Fewer
  // taught words simply means fewer tiles.
  const poolAt = (i) => wordsAt(i).map((w) => w.id);
  const sentencesAt = (i) => {
    const known = new Set(wordsAt(i).map((w) => w.word));
    return sentences.filter((id) =>
      C.sentence(id).tokens.every((t) => !C.word(`w:${t}`) || known.has(t))
    );
  };
  const ctx = { poolAt, wordsAt, sentencesAt, room };

  // The introduction's own two-way check draws on this lesson's words, met or
  // about to be: what it shows is a pair of English meanings, not a pair of
  // words to read.
  const lessonWords = [...review, ...batch].map((w) => w.id);
  for (const [id, at] of introAt) {
    put(at, makers.meet(C.word(id), lessonWords));
  }

  for (const w of batch) {
    const at = introAt.get(w.id);
    reserve(slots, at).forEach((i, step) => put(i, retrieval(w, step, i, ctx)));
  }

  fillRest(slots, ctx, counts, put);
  return slots.filter(Boolean);
}

// Whatever slots the ladders did not claim, filled with the least-used type
// that has data behind it, so the lesson rounds out instead of stacking one
// kind of exercise.
function fillRest(slots, ctx, counts, put) {
  let wi = 0;
  let si = 0;

  // Which words the exercise before this slot already asked about, so a filler
  // does not drill the same word twice in a row.
  const justAsked = (i) => {
    const prev = i > 0 ? slots[i - 1] : null;
    if (!prev) return new Set();
    if (prev.word) return new Set([prev.word.id]);
    if (prev.left) return new Set(prev.left.map((w) => w.id));
    return new Set();
  };

  const make = (type, i) => {
    const words = ctx.wordsAt(i);
    const sents = ctx.sentencesAt(i);
    const skip = justAsked(i);
    const nextWord = () => {
      for (let n = 0; n < words.length; n++) {
        const w = words[wi++ % words.length];
        if (!skip.has(w.id)) return w;
      }
      return words[wi++ % words.length];
    };
    const nextSentence = () => (sents.length ? C.sentence(sents[si++ % sents.length]) : null);
    if (type === 'match') {
      const n = Math.min(4, words.length);
      return n >= 3 ? makers.match(sample(words, n), pick(['pinyin', 'meaning'])) : null;
    }
    if (type === 'selectHanzi' || type === 'selectMeaning' || type === 'listenWord') {
      return words.length ? makers[type](nextWord(), ctx.poolAt(i)) : null;
    }
    if (type === 'tone') return words.length ? makers.tone(nextWord()) : null;
    const s = nextSentence();
    if (!s) return null;
    if (type === 'bankEn') return makers.bankEn(s, sents);
    if (type === 'bankZh') return makers.bankZh(s, ctx.poolAt(i));
    if (type === 'listenSent') return makers.listenSent(s, ctx.poolAt(i));
    return s.tokens.length >= 3 ? makers.cloze(s, ctx.poolAt(i)) : null;
  };
  // The silent types lead, so on a tie a lesson rounds out the way it always
  // has and the audio types take what is left.
  const types = [
    'match', 'bankEn', 'bankZh', 'cloze', 'selectHanzi', 'selectMeaning',
    ...(canHear() ? ['listenWord', 'tone', 'listenSent'] : []),
  ];

  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) continue;
    const order = types
      .filter((t) => ctx.room(t))
      .sort((a, b) => (counts[a] ?? 0) - (counts[b] ?? 0));
    for (const t of order) if (put(i, make(t, i))) break;
  }
}

// Which exercise types a review level leans on. The first reviews the unit;
// the last also brings back the units before it and leans on production.
const REVIEW_RECIPE = [
  ['selectHanzi', 'selectMeaning', 'match', 'bankZh', 'cloze', 'listenWord', 'tone'],
  ['bankZh', 'cloze', 'bankEn', 'match', 'listenSent', 'selectHanzi', 'tone'],
];

// A hard replay is all production for as long as the sentences hold out.
// Recognition only turns up once every production type has hit its cap.
const HARD_RECIPE = ['bankZh', 'cloze', 'bankEn', 'listenSent', 'tone', 'selectHanzi', 'match'];

// A review level: no introductions, fifteen slots of practice, least-practised
// words first.
function reviewLesson(u, level) {
  const r = level - C.introBatches(u).length; // 1-based among review levels
  return drill(u, {
    wide: r >= 2,
    recipe: REVIEW_RECIPE[Math.min(r, REVIEW_RECIPE.length) - 1],
  });
}

// Replaying a finished unit: everything taught up to it, production first,
// and -- through the module flag above -- more to choose between.
function hardLesson(u) {
  return drill(u, { wide: true, recipe: HARD_RECIPE });
}

// Fifteen slots walked off a recipe. `wide` widens the pool from the unit's
// own words and sentences to everything taught up to and including it.
function drill(u, { wide, recipe }) {
  const pool = C.wordsThrough(u.id);
  const poolSentences = C.sentencesThrough(u.id);

  const wordBag = (wide ? pool : u.words).slice().sort(byPractice).map(C.word).filter(Boolean);
  const sentBag = shuffle([...(wide ? poolSentences : u.sentences)]).map(C.sentence);

  const items = [];
  const counts = {};
  const room = (type) => (counts[type] ?? 0) < TYPE_CAP;
  const push = (ex) => {
    if (!ex) return;
    items.push(ex);
    counts[ex.type] = (counts[ex.type] ?? 0) + 1;
  };

  let wi = 0;
  let si = 0;
  const nextWord = () => wordBag[wi++ % wordBag.length];
  const nextSentence = () => (sentBag.length ? sentBag[si++ % sentBag.length] : null);

  // Walk the recipe in a loop. The cursor advances on every pass, capped or
  // not, so a type that has hit its cap cannot stall the whole lesson.
  let step = 0;
  let guard = 0;
  // A recipe names the audio types in silence too; they are skipped here.
  const hear = canHear();
  while (items.length < LESSON_SIZE && guard++ < LESSON_SIZE * 12) {
    const type = recipe[step++ % recipe.length];
    if (!room(type)) continue;
    if (AUDIO_TYPES.has(type) && !hear) continue;
    if (type === 'match') {
      const n = Math.min(4, wordBag.length);
      if (n < 3) continue;
      push(makers.match(sample(wordBag, n), pick(['pinyin', 'meaning'])));
    } else if (['bankZh', 'bankEn', 'cloze', 'listenSent'].includes(type)) {
      const s = nextSentence();
      if (!s) continue;
      if (type === 'cloze' && s.tokens.length < 3) continue;
      push(
        type === 'bankEn' ? makers.bankEn(s, poolSentences) : makers[type](s, pool)
      );
    } else if (type === 'tone') {
      push(makers.tone(nextWord()));
    } else {
      push(makers[type](nextWord(), pool));
    }
  }

  return items.slice(0, LESSON_SIZE);
}

// -- practice sets ------------------------------------------------------

// The Practice hub plays a queue that FSRS chose, not a unit: one exercise per
// due item, in due order, drawing distractors from everything taught so far.
// A word alternates between the two select types; a sentence rotates through
// the ways of producing it, so the same sentence does not always come back as
// the same exercise. A listening card rotates through hearing the word,
// naming a tone in it, and hearing a sentence that uses it.
export function buildPractice(items, size = LESSON_SIZE) {
  const pool = C.readyUnits().flatMap((u) => u.words);
  const poolSentences = C.readyUnits().flatMap((u) => u.sentences);
  const out = [];
  let n = 0;

  for (const it of items) {
    if (out.length >= size) break;
    if (it.id.startsWith('w:') && it.kind === 'l') {
      const w = C.word(it.id);
      if (!w || !canHear()) continue;
      out.push(listenPractice(w, n++, pool, poolSentences));
    } else if (it.id.startsWith('w:')) {
      const w = C.word(it.id);
      if (!w) continue;
      out.push((n++ % 2 ? makers.selectMeaning : makers.selectHanzi)(w, pool));
    } else if (it.id.startsWith('s:')) {
      const s = C.sentence(it.id);
      if (!s) continue;
      const types = s.tokens.length >= 3 ? ['bankZh', 'cloze', 'bankEn'] : ['bankZh', 'bankEn'];
      const type = types[n++ % types.length];
      out.push(
        type === 'bankEn' ? makers.bankEn(s, poolSentences) : makers[type](s, pool)
      );
    }
  }
  return out;
}

function listenPractice(w, n, pool, poolSentences) {
  const turn = n % 3;
  if (turn === 1) {
    const ex = makers.tone(w);
    if (ex) return ex;
  }
  if (turn === 2) {
    const ids = poolSentences.filter((id) => C.sentence(id).tokens.includes(w.word));
    if (ids.length) return makers.listenSent(C.sentence(pick(ids)), pool);
  }
  return makers.listenWord(w, pool);
}

export function checkBank(ex, given) {
  const norm = (a) => a.map((t) => String(t).trim().toLowerCase()).join(' ');
  return ex.accepted.some((a) => norm(a) === norm(given));
}
