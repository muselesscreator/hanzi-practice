import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
} from '../vendor/ts-fsrs.mjs';

export { Rating, State };

const KEY = 'hanzi-practice:v1';
export const VERSION = 3;

export const scheduler = fsrs(
  generatorParameters({ enable_fuzz: true, request_retention: 0.9 })
);

export const today = () => new Date().toISOString().slice(0, 10);
export const dayOffset = (n, from = new Date()) =>
  new Date(from.getTime() + n * 86400000).toISOString().slice(0, 10);

// ── shape ─────────────────────────────────────────────────────────────

// Card keys are `<id>:<kind>`. The id may itself contain colons, so always
// split on the last one: `char:w`, `w:你:r`, `s:b1l3-04:b`.
export const keyOf = (id, kind) => `${id}:${kind}`;
export const idOf = (key) => key.slice(0, key.lastIndexOf(':'));
export const kindOf = (key) => key.slice(key.lastIndexOf(':') + 1);

export const blank = () => ({
  v: VERSION,
  settings: {
    newPerDay: 8,
    readCards: true,
    dailyGoal: 30,
    bookToken: '', // shared secret that unlocks the gated /textbooks/ PDFs
  },
  cards: {},
  exposure: {}, // card key -> active retrievals, lifetime
  intro: {}, // date -> characters introduced that day
  course: {
    progress: {}, // unitId -> { done: levels completed }
    xp: {}, // date -> xp earned
    streak: { n: 0, last: null, freeze: 1 },
  },
});

// v1 stored only the handwriting deck. Its card keys (`char:w`, `char:r`) are
// already in the v2 shape, so the migration is additive: keep every FSRS card
// and every introduction date, and graft the course state on beside them.
// v2 -> v3 is additive too: the retrieval counter starts empty, so a word
// learned before the bump reads as unexposed and review leans toward it.
function migrate(raw) {
  const base = blank();
  if (raw.v === 1) {
    return {
      ...base,
      settings: { ...base.settings, ...raw.settings },
      cards: raw.cards ?? {},
      intro: raw.intro ?? {},
    };
  }
  if (raw.v === 2 || raw.v === VERSION) {
    return {
      ...base,
      ...raw,
      v: VERSION,
      settings: { ...base.settings, ...raw.settings },
      exposure: raw.exposure ?? {},
      course: {
        ...base.course,
        ...raw.course,
        streak: { ...base.course.streak, ...raw.course?.streak },
      },
    };
  }
  return base;
}

function revive(s) {
  for (const c of Object.values(s.cards)) {
    c.due = new Date(c.due);
    if (c.last_review) c.last_review = new Date(c.last_review);
  }
  return s;
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw) return blank();
    return revive(migrate(raw));
  } catch {
    return blank();
  }
}

export let store = load();

let onFull = () => {};
export const setStorageFullHandler = (fn) => {
  onFull = fn;
};

let saveTimer;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      onFull();
    }
  }, 250);
}

export function importBackup(raw) {
  if (![1, 2, VERSION].includes(raw.v)) throw new Error('version');
  localStorage.setItem(KEY, JSON.stringify(raw));
  store = load();
  return store;
}

export function eraseAll() {
  localStorage.removeItem(KEY);
  store = blank();
}

export function exportBlob() {
  return JSON.stringify(store);
}

// ── scheduling ────────────────────────────────────────────────────────

export function grade(id, kind, rating) {
  const k = keyOf(id, kind);
  const card = store.cards[k] ?? createEmptyCard(new Date());
  store.cards[k] = scheduler.next(card, new Date(), rating).card;
  save();
}

export const seen = (id, kind) => Boolean(store.cards[keyOf(id, kind)]);

// Lifetime count of times this card was actively retrieved -- answered as the
// thing under test, rather than met or merely read. FSRS does not take an
// exposure count as an input the way Duolingo's HLR does, so the generator
// keeps its own and uses it to bias review toward under-practised words.
// See docs/duolingo-teaching-pattern.md section 5.5.
export const LIFETIME_TARGET = 10;

export const exposureOf = (id, kind) => store.exposure[keyOf(id, kind)] ?? 0;

export function countExposure(id, kind, n = 1) {
  if (n <= 0) return;
  const k = keyOf(id, kind);
  store.exposure[k] = (store.exposure[k] ?? 0) + n;
  save();
}

export function start(id, kind) {
  const k = keyOf(id, kind);
  if (!store.cards[k]) store.cards[k] = createEmptyCard(new Date());
  save();
}

// Card kinds are shared across item types — a character's reading card and a
// word's reading card are both kind `r` — so the id prefix is what tells them
// apart: `w:` for a course word, `s:` for a sentence, a bare character
// otherwise.
export const isWordKey = (k) => k.startsWith('w:');
export const isSentKey = (k) => k.startsWith('s:');
export const isCharKey = (k) => !isWordKey(k) && !isSentKey(k);

// Every card of `kinds` that is due, soonest first. `only` narrows by key.
export function due(kinds, only = () => true, now = new Date()) {
  const want = new Set([].concat(kinds));
  return Object.entries(store.cards)
    .filter(([k, c]) => want.has(kindOf(k)) && only(k) && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => ({ id: idOf(k), kind: kindOf(k), key: k }));
}

// Cards you got wrong and have not yet put right: FSRS drops a lapsed card
// into Relearning and only lets it back into Review once it comes back clean.
// That is the Mistakes lane.
export function lapsed(only = () => true) {
  return Object.entries(store.cards)
    .filter(([k, c]) => only(k) && c.state === State.Relearning)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => ({ id: idOf(k), kind: kindOf(k), key: k }));
}

// Counts one more character introduced today, against the new-per-day limit.
export function introduce() {
  const d = today();
  store.intro[d] = (store.intro[d] ?? 0) + 1;
  save();
}

export const newBudget = () =>
  Math.max(0, store.settings.newPerDay - (store.intro[today()] ?? 0));

// ── xp, streak, daily goal ────────────────────────────────────────────

export const xpToday = () => store.course.xp[today()] ?? 0;
export const goalMet = () => xpToday() >= store.settings.dailyGoal;

export function addXp(n) {
  const d = today();
  store.course.xp[d] = (store.course.xp[d] ?? 0) + n;
  bumpStreak();
  save();
}

// The streak counts days on which you earned any XP. One missed day is
// forgiven if a freeze is in hand; a longer gap starts over.
function bumpStreak() {
  const s = store.course.streak;
  const d = today();
  if (s.last === d) return;
  if (s.last === dayOffset(-1)) {
    s.n += 1;
  } else if (s.last === dayOffset(-2) && s.freeze > 0) {
    s.freeze -= 1;
    s.n += 1;
  } else {
    s.n = 1;
  }
  s.last = d;
}

// A streak stays alive through today even before you have earned any XP.
export function streakDays() {
  const s = store.course.streak;
  if (!s.last) return 0;
  return s.last === today() || s.last === dayOffset(-1) ? s.n : 0;
}

// ── course progress ───────────────────────────────────────────────────

export const unitProgress = (unitId) => store.course.progress[unitId]?.done ?? 0;

export function completeLevel(unitId, levels) {
  const p = (store.course.progress[unitId] ??= { done: 0 });
  p.done = Math.min(levels, p.done + 1);
  save();
  return p.done;
}
