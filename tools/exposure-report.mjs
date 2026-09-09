#!/usr/bin/env node
/**
 * How much retrieval practice does a generated lesson actually give?
 *
 * Builds the same lesson many times and counts, per word of the unit, how
 * often the learner has to retrieve it, and how far after its introduction the
 * first retrieval lands. Written for docs/duolingo-teaching-pattern.md; rerun
 * it after any change to the lesson recipe.
 *
 * Usage: node tools/exposure-report.mjs [unitId] [runs]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNIT = process.argv[2] ?? 'b1l1';
const RUNS = Number(process.argv[3] ?? 500);

// The store module reaches for localStorage; a Map is enough off-browser.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const co = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/course.json'), 'utf8'));
const C = await import('../js/course.js');
const E = await import('../js/exercises.js');
await C.loadCourse(co);

const unit = co.units.find((u) => u.id === UNIT);
if (!unit) {
  console.error(`no unit ${UNIT}. units: ${co.units.map((u) => u.id).join(' ')}`);
  process.exit(1);
}

// Active: the word is the thing under test, and getting it right means having
// retrieved it. Passive: it merely appears in a prompt the learner reads.
export function classify(ex) {
  const active = new Set();
  const passive = new Set();
  let met = null;
  if (ex.type === 'meet') {
    met = ex.word.id;
  } else if (ex.type === 'selectHanzi' || ex.type === 'selectMeaning') {
    active.add(ex.word.id);
  } else if (ex.type === 'match') {
    for (const w of ex.left) active.add(w.id);
  } else if (ex.type === 'cloze') {
    active.add(`w:${ex.answer}`);
    for (const t of ex.sentence.tokens) if (t !== ex.answer) passive.add(`w:${t}`);
  } else if (ex.type === 'bankZh') {
    for (const t of ex.sentence.tokens) active.add(`w:${t}`);
  } else if (ex.type === 'bankEn') {
    for (const t of ex.sentence.tokens) passive.add(`w:${t}`);
  }
  return { active, passive, met };
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;

// Which words a level introduces is a property of the unit's schedule, not of
// what the store has seen, so a fresh store reports every level faithfully.
function report(level) {
  const active = new Map(unit.words.map((w) => [w, []]));
  const passive = new Map(unit.words.map((w) => [w, []]));
  const types = new Map();
  let lagSum = 0;
  let lagN = 0;
  let adjacent = 0;

  for (let r = 0; r < RUNS; r++) {
    mem.clear();
    const items = E.buildLesson(unit, level);
    const a = new Map(unit.words.map((w) => [w, 0]));
    const p = new Map(unit.words.map((w) => [w, 0]));
    const metAt = new Map();

    items.forEach((ex, i) => {
      types.set(ex.type, (types.get(ex.type) ?? 0) + 1);
      const c = classify(ex);
      if (c.met) metAt.set(c.met, i);
      for (const id of c.active) if (a.has(id)) a.set(id, a.get(id) + 1);
      for (const id of c.passive) if (p.has(id)) p.set(id, p.get(id) + 1);
    });

    for (const [id, at] of metAt) {
      const first = items.findIndex((ex, i) => i > at && classify(ex).active.has(id));
      if (first < 0) continue;
      lagSum += first - at;
      lagN += 1;
      if (first - at === 1) adjacent += 1;
    }

    for (const [k, v] of a) active.get(k).push(v);
    for (const [k, v] of p) passive.get(k).push(v);
  }

  const teaching = level <= (unit.intro?.length ?? 0);
  console.log(`\n${UNIT} level ${level} — ${teaching ? 'teaching' : 'review'}`);
  console.log(
    `  types per lesson: ${[...types]
      .sort((x, y) => y[1] - x[1])
      .map(([t, n]) => `${t} ${(n / RUNS).toFixed(1)}`)
      .join(', ')}`
  );
  for (const id of unit.words) {
    const a = active.get(id);
    console.log(
      `  ${id.padEnd(9)} retrievals ${mean(a).toFixed(2).padStart(5)}` +
        `  min ${Math.min(...a)}  max ${Math.max(...a)}` +
        `  never ${pct(a.filter((x) => x === 0).length, RUNS).padStart(4)}` +
        `  once or less ${pct(a.filter((x) => x <= 1).length, RUNS).padStart(4)}` +
        `  read-only ${mean(passive.get(id)).toFixed(2)}`
    );
  }
  if (lagN) {
    console.log(
      `  meet to first retrieval: mean ${(lagSum / lagN).toFixed(1)} exercises,` +
        ` immediately next ${pct(adjacent, lagN)}`
    );
  }
}

console.log(
  `${RUNS} runs per level, ${unit.words.length} words in ${UNIT}, ` +
    `${unit.intro?.length ?? 0} teaching levels of ${unit.levels}`
);
for (let level = 1; level <= unit.levels; level++) report(level);
