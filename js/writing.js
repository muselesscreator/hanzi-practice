import { store, keyOf, due, isCharKey, newBudget, unitProgress } from './store.js';
import * as C from './course.js';

// The writing track. Characters are drawn from the course, one unit at a
// time, in an order that puts every component before the character it builds.
// A unit's characters unlock once a lesson of that unit has been played, so
// writing trails reading by a unit or so — you have met 谢谢 as a word before
// you are asked to write 讠, 射 and then 谢.
//
// data/curriculum.json is still read, for two reasons: it is the stroke source
// for characters the course does not carry, and cards started in the original
// HSK-band deck keep coming up for review.

let deck = null; // curriculum.json
const deckByChar = new Map();
const deckUnitOf = new Map(); // char -> curriculum unit number
const strokes = {}; // char -> { strokes, medians }
const loaded = new Set(); // bundle keys already fetched

const WORDS_NEW = 2; // new write-the-word cards per session

export async function loadDeck(data) {
  deck = data ?? (await (await fetch('data/curriculum.json')).json());
  for (const c of deck.cards) deckByChar.set(c.char, c);
  for (const u of deck.units) {
    for (const i of u.lessons.flat()) deckUnitOf.set(deck.cards[i].char, u.n);
  }
  return deck;
}

// ── cards ─────────────────────────────────────────────────────────────

// Both sources produce the same card shape, so the drill does not care which
// one a character came from. The course card wins where it has one: its gloss
// is the sense the lesson teaches, and it knows whether the character is a
// building block.
export function card(ch) {
  return C.course?.chars[ch] ?? deckByChar.get(ch) ?? null;
}

const isBlock = (ch) => Boolean(card(ch)?.block);

export const writable = (ch) => Boolean(card(ch));

// ── unlocking ─────────────────────────────────────────────────────────

export const unlockedUnits = () =>
  C.readyUnits().filter((u) => u.writing.length && unitProgress(u.id) > 0);

// Every character the writing track has opened up, in track order.
export const track = () => unlockedUnits().flatMap((u) => u.writing);

export const started = (ch) => Boolean(store.cards[keyOf(ch, 'w')]);

// ── stroke data ───────────────────────────────────────────────────────

export const strokeData = (ch) => strokes[ch];

async function fetchBundle(key, file) {
  if (loaded.has(key)) return;
  loaded.add(key);
  try {
    Object.assign(strokes, await (await fetch(file)).json());
  } catch {
    loaded.delete(key);
  }
}

// A character's outlines live with its course unit when the course carries it,
// and with its curriculum unit otherwise.
export async function loadStrokes(chars) {
  const jobs = new Map();
  for (const ch of new Set(chars)) {
    const unit = C.course?.chars[ch]?.unit;
    if (unit) {
      jobs.set(`course:${unit}`, `data/units/${unit}.json`);
      continue;
    }
    const n = deckUnitOf.get(ch);
    if (n) {
      jobs.set(`deck:${n}`, `data/strokes/unit-${String(n).padStart(2, '0')}.json`);
    }
  }
  await Promise.all([...jobs].map(([key, file]) => fetchBundle(key, file)));
  return chars.filter((ch) => strokes[ch]);
}

// ── the queue ─────────────────────────────────────────────────────────

// Characters whose writing or reading card is due. Cards started in the old
// deck are included even when the course has never heard of the character.
export const dueChars = () =>
  due(['w', 'r'], isCharKey)
    .filter((x) => writable(x.id))
    .map((x) => ({ id: x.id, kind: x.kind, isNew: false, type: type(x.id) }));

const type = (ch) => (isBlock(ch) ? 'block' : 'char');

// The next characters to teach: track order, skipping anything already
// started, capped by the day's new-character budget.
export function newChars(limit = newBudget()) {
  const out = [];
  for (const ch of track()) {
    if (out.length >= limit) break;
    if (!started(ch) && writable(ch)) {
      out.push({ id: ch, kind: 'w', isNew: true, type: type(ch) });
    }
  }
  return out;
}

// Write-the-word cards: a word of two or three characters, written in
// sequence. A word only qualifies once every character in it has a writing
// card of its own, so the sequence is never the first time you meet a shape.
export function wordItems() {
  const ready = unlockedUnits()
    .flatMap((u) => u.words)
    .map(C.word)
    .filter((w) => w.chars.length > 1 && w.chars.every(started));

  const items = [];
  for (const w of ready) {
    const sched = store.cards[keyOf(w.id, 'w')];
    if (sched && sched.due <= new Date()) {
      items.push({ id: w.id, kind: 'w', isNew: false, type: 'word', due: sched.due });
    }
  }
  items.sort((a, b) => a.due - b.due);

  const fresh = ready
    .filter((w) => !store.cards[keyOf(w.id, 'w')])
    .slice(0, WORDS_NEW)
    .map((w) => ({ id: w.id, kind: 'w', isNew: true, type: 'word' }));

  return [...items, ...fresh];
}

// ── progress ──────────────────────────────────────────────────────────

export function trackProgress() {
  const chars = track();
  return {
    unlocked: chars.length,
    started: chars.filter(started).length,
    locked: C.readyUnits()
      .filter((u) => u.writing.length && unitProgress(u.id) === 0)
      .reduce((n, u) => n + u.writing.length, 0),
  };
}

// Cards from the original deck that the course does not carry. Shown so the
// old deck's progress does not silently vanish from the screen.
export const legacyStarted = () =>
  deck
    ? deck.cards.filter((c) => !C.course?.chars[c.char] && started(c.char)).length
    : 0;
