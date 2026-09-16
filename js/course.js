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

// ── cultivation realms ────────────────────────────────────────────────
// Lifetime qì (total XP) refines the learner through a ladder of realms, each
// with four sub-stages. The numbers are the qì needed to ENTER a stage: plain,
// tunable data, set so an active learner breaks through every few days early on
// and slows at the higher realms. Purely cosmetic -- nothing here feeds FSRS.
const STAGE_ZH = ['初期', '中期', '后期', '大圆满'];
const STAGE_EN = ['Early', 'Middle', 'Late', 'Peak'];

// [realm-zh, realm-en, [enter-qì per stage]], ascending. The last realm is
// terminal: a single stage with no breakthrough beyond it.
const REALM_TABLE = [
  ['炼气', 'Qi Condensation', [0, 30, 70, 120]],
  ['筑基', 'Foundation Establishment', [200, 320, 460, 620]],
  ['金丹', 'Golden Core', [850, 1150, 1500, 1900]],
  ['元婴', 'Nascent Soul', [2400, 3000, 3700, 4500]],
  ['化神', 'Soul Transformation', [5500, 6700, 8100, 9700]],
  ['渡劫', 'Tribulation', [11500, 13600, 16000, 18700]],
  ['飞升', 'Ascension', [22000]],
];

const STAGES = REALM_TABLE.flatMap(([zh, en, qis]) =>
  qis.map((qi, i) => ({
    qi,
    realm: zh,
    realmEn: en,
    stage: qis.length > 1 ? STAGE_ZH[i] : '',
    stageEn: qis.length > 1 ? STAGE_EN[i] : '',
  }))
);

// The cultivation standing for a lifetime qì total: the current stage, and how
// far it sits toward the next breakthrough.
export function realmFor(qi = totalXp()) {
  let i = 0;
  while (i + 1 < STAGES.length && STAGES[i + 1].qi <= qi) i += 1;
  const cur = STAGES[i];
  const next = STAGES[i + 1] ?? null;
  const floor = cur.qi;
  const ceil = next ? next.qi : cur.qi;
  const into = qi - floor;
  const span = Math.max(1, ceil - floor);
  return {
    index: i,
    qi,
    realm: cur.realm,
    realmEn: cur.realmEn,
    stage: cur.stage,
    stageEn: cur.stageEn,
    title: cur.stage ? `${cur.realm} ${cur.stage}` : cur.realm,
    titleEn: cur.stageEn ? `${cur.realmEn} · ${cur.stageEn}` : cur.realmEn,
    next,
    atPeak: !next,
    into,
    span,
    toNext: next ? ceil - qi : 0,
    pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100,
  };
}
