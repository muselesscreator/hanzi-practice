import { store, save, LIFETIME_TARGET } from './store.js';
import { totalXp, realmFor } from './course.js';

// Cosmetic spoils of cultivation: Dao titles (道号) earned at milestones, pills
// (丹药) the streak furnace brews, and techniques (功法) learned by drilling.
// All are flavour only -- they read the learner's standing and grant a
// collectible, and never feed FSRS or XP. Each entry's `test` runs against a
// snapshot of the current standing.

function snapshot() {
  const levels = Object.values(store.course.progress).reduce(
    (n, p) => n + (p.done ?? 0),
    0
  );
  const counts = Object.values(store.exposure);
  // Total lifetime retrievals, and how many cards are drilled past the point
  // FSRS treats as thoroughly practised -- the two axes techniques gate on.
  const drills = counts.reduce((n, c) => n + c, 0);
  const mastered = counts.filter((c) => c >= LIFETIME_TARGET).length;
  return {
    qi: totalXp(),
    realm: realmFor().index,
    streak: store.course.streak.n,
    levels,
    cards: Object.keys(store.cards).length,
    drills,
    mastered,
  };
}

// Dao titles. `zh` is the title itself; `en` glosses it; `hint` says how it is
// won, shown while it is still locked.
export const TITLES = [
  { id: 'qi-condensed', zh: '炼气士', en: 'Qi Condensate', hint: 'Break through once', test: (s) => s.realm >= 1 },
  { id: 'foundation', zh: '筑基修士', en: 'Foundation Cultivator', hint: 'Reach the Foundation realm', test: (s) => s.realm >= 4 },
  { id: 'golden-core', zh: '金丹真人', en: 'Golden Core Adept', hint: 'Reach the Golden Core realm', test: (s) => s.realm >= 8 },
  { id: 'nascent-soul', zh: '元婴老祖', en: 'Nascent Soul Patriarch', hint: 'Reach the Nascent Soul realm', test: (s) => s.realm >= 12 },
  { id: 'ascendant', zh: '飞升者', en: 'The Ascended', hint: 'Ascend', test: (s) => s.realm >= 24 },
  { id: 'diligent', zh: '勤学不辍', en: 'Never Skips Cultivation', hint: 'Hold a 7-day streak', test: (s) => s.streak >= 7 },
  { id: 'iron-will', zh: '铁心道人', en: 'The Iron-Willed Daoist', hint: 'Hold a 30-day streak', test: (s) => s.streak >= 30 },
  { id: 'sea-of-study', zh: '学海无涯', en: 'The Shoreless Sea of Study', hint: 'Finish 25 lesson levels', test: (s) => s.levels >= 25 },
  { id: 'stroke-grandmaster', zh: '笔顺宗师', en: 'Stroke-Order Grandmaster', hint: 'Finish 10 lesson levels', test: (s) => s.levels >= 10 },
  { id: 'tone-deaf-immortal', zh: '五音不全的仙人', en: 'The Tone-Deaf Immortal', hint: 'Meet 50 cards', test: (s) => s.cards >= 50 },
];

// Pills the furnace brews at streak and realm milestones. Pure flavour text.
export const PILLS = [
  { id: 'qi-gathering', zh: '聚气丹', en: 'Qi-Gathering Pill', flavor: 'Smells of morning dew. Gathers nothing in particular.', hint: 'Hold a 3-day streak', test: (s) => s.streak >= 3 },
  { id: 'foundation-pill', zh: '筑基丹', en: 'Foundation Pill', flavor: 'The genuine article, allegedly. Grants +0 to all attributes.', hint: 'Reach the Foundation realm', test: (s) => s.realm >= 4 },
  { id: 'nine-turn', zh: '九转还魂丹', en: 'Nine-Turn Soul-Reviving Pill', flavor: 'Revives the soul after fourteen dawns of study. Tastes of licorice.', hint: 'Hold a 14-day streak', test: (s) => s.streak >= 14 },
  { id: 'marrow-cleansing', zh: '洗髓丹', en: 'Marrow-Cleansing Pill', flavor: 'Cleanses the marrow of every forgotten radical.', hint: 'Reach the Golden Core realm', test: (s) => s.realm >= 8 },
  { id: 'everlasting-youth', zh: '驻颜丹', en: 'Everlasting Youth Pill', flavor: 'Halts aging entirely, as far as anyone has managed to disprove.', hint: 'Hold a 30-day streak', test: (s) => s.streak >= 30 },
  { id: 'dragon-tiger', zh: '龙虎金丹', en: 'Dragon-Tiger Golden Elixir', flavor: 'Roars faintly in the bottle. Do not shake.', hint: 'Reach the Nascent Soul realm', test: (s) => s.realm >= 12 },
];

// Techniques (功法) drilled into muscle memory by repetition. `drills` is the
// lifetime count of active retrievals across every card; `mastered` counts the
// cards drilled past the practice target. `flavor` is the technique's effect,
// tongue firmly in cheek; `hint` says how it is learned while still locked.
export const TECHNIQUES = [
  { id: 'breathing', zh: '吐纳术', en: 'Breathing Method', flavor: 'Inhale a radical, exhale a tone. The first thing any disciple learns.', hint: 'Drill cards 20 times', test: (s) => s.drills >= 20 },
  { id: 'iron-shirt', zh: '铁布衫', en: 'Iron Shirt', flavor: 'Toughens the memory against the blows of forgetting.', hint: 'Drill cards 100 times', test: (s) => s.drills >= 100 },
  { id: 'flying-sword', zh: '御剑术', en: 'Flying Sword', flavor: 'Recall a character before it hits the ground. Mostly for show.', hint: 'Master 5 cards', test: (s) => s.mastered >= 5 },
  { id: 'golden-bell', zh: '金钟罩', en: 'Golden Bell Shield', flavor: 'Wraps fifteen well-worn words in an impenetrable dome.', hint: 'Master 15 cards', test: (s) => s.mastered >= 15 },
  { id: 'five-thunders', zh: '五雷正法', en: 'Five Thunders Orthodox Method', flavor: 'Smites five hundred repetitions with righteous electricity.', hint: 'Drill cards 500 times', test: (s) => s.drills >= 500 },
  { id: 'divine-sense', zh: '神识外放', en: 'Divine Sense Projection', flavor: 'Your awareness reaches out and touches forty mastered cards at once.', hint: 'Master 40 cards', test: (s) => s.mastered >= 40 },
];

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const TITLE = byId(TITLES);
export const PILL = byId(PILLS);
export const TECHNIQUE = byId(TECHNIQUES);

// Grant every title and pill now earned but not yet held. Returns the freshly
// granted entries (tagged with their kind) so a caller can announce them; an
// empty array means nothing new. Safe to call on load to backfill old saves.
export function checkRewards() {
  const s = snapshot();
  const granted = [];
  for (const t of TITLES) {
    if (!store.gamify.titles.includes(t.id) && t.test(s)) {
      store.gamify.titles.push(t.id);
      granted.push({ kind: 'title', ...t });
    }
  }
  for (const p of PILLS) {
    if (!store.gamify.pills.includes(p.id) && p.test(s)) {
      store.gamify.pills.push(p.id);
      granted.push({ kind: 'pill', ...p });
    }
  }
  for (const t of TECHNIQUES) {
    if (!store.gamify.techniques.includes(t.id) && t.test(s)) {
      store.gamify.techniques.push(t.id);
      granted.push({ kind: 'technique', ...t });
    }
  }
  if (granted.length) save();
  return granted;
}
