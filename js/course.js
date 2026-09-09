import { store, unitProgress } from './store.js';

export let course = null;

// `data` lets the checks feed the course in from disk instead of over fetch.
export async function loadCourse(data) {
  course = data ?? (await (await fetch('data/course.json')).json());
  return course;
}

export const unit = (id) => course.units.find((u) => u.id === id);
export const word = (id) => course.words[id];
export const sentence = (id) => course.sentences[id];
export const grammar = (id) => course.grammar[id];

export const readyUnits = () => course.units.filter((u) => u.ready);

export const unitDone = (u) => unitProgress(u.id) >= u.levels;

// Units unlock in order: the first one is always open, and each later one
// opens when the one before it is finished.
export function unlocked(u) {
  const list = readyUnits();
  const i = list.findIndex((x) => x.id === u.id);
  if (i <= 0) return i === 0;
  return unitDone(list[i - 1]);
}

export function currentUnit() {
  const list = readyUnits();
  return list.find((u) => !unitDone(u)) ?? list[list.length - 1] ?? null;
}

// The level about to be played for a unit: 1-based, and clamped so a finished
// unit replays its last level as practice.
export const nextLevel = (u) => Math.min(u.levels, unitProgress(u.id) + 1);

// Which words each teaching level introduces. The builder writes these
// batches into the unit; the fallback chunks the word list the same way, so a
// stale cached course.json degrades instead of teaching nothing. See
// docs/duolingo-teaching-pattern.md section 5.2.
export const INTRO_CAP = 3;

export function introBatches(u) {
  if (Array.isArray(u.intro)) return u.intro;
  const out = [];
  for (let i = 0; i < u.words.length; i += INTRO_CAP)
    out.push(u.words.slice(i, i + INTRO_CAP));
  return out;
}

// The batch a level introduces, empty for a review level.
export const introBatch = (u, level) => introBatches(u)[level - 1] ?? [];

export const isTeachLevel = (u, level) => level <= introBatches(u).length;

// Every word taught up to and including a unit -- the pool a sentence or a
// distractor is allowed to draw from.
export function wordsThrough(unitId) {
  const out = [];
  for (const u of readyUnits()) {
    out.push(...u.words);
    if (u.id === unitId) break;
  }
  return out;
}

export function sentencesThrough(unitId) {
  const out = [];
  for (const u of readyUnits()) {
    out.push(...u.sentences);
    if (u.id === unitId) break;
  }
  return out;
}

export const totalXp = () =>
  Object.values(store.course.xp).reduce((n, x) => n + x, 0);
