# Cultivation gamification — design plan

A motivation layer for hanzi-practice themed on Chinese cultivation (修仙 / xianxia):
you refine **qì (气)** through daily practice and **break through (突破)** into higher
cultivation realms. Every reward is cosmetic — it never touches the FSRS schedule or
the real learning loop. The theme is a natural fit: cultivation is the Chinese fantasy
genre, and its realm names double as vocabulary.

Companion research on free, license-clean UI assets lives in
[`cultivation-assets-research.md`](./cultivation-assets-research.md).

## The core idea

Turn the existing-but-inert motivation UI into a progression that *pays off*. Today the
daily-goal ring fills and nothing happens (`app.js:120-124`), and cumulative XP is summed
by `totalXp()` (`js/course.js:77`) which **nothing calls**. That unused function is the
progression spine: total qì drives your realm, and crossing a threshold is a breakthrough —
the celebration the current app is missing.

## The reskin (existing mechanic → cultivation)

| Today | Becomes | Code touchpoint |
|---|---|---|
| Total XP (unused `totalXp()`) | **Qì (气)** — drives realm | `js/course.js:77` |
| Daily-goal ring | Today's qì-gathering (打坐) | `app.js:120`, `app.css:616` |
| Streak + freeze | Unbroken cultivation; freeze = protection talisman vs 走火入魔 | `js/store.js:44,215` |
| Lesson-done `+N XP` | Qì gained, plus any breakthrough banner | `js/lesson.js:835` |
| Nothing on bar-fill | **Breakthrough (突破)** celebration | new |

### Realm ladder

The classic xianxia progression. Each realm has the traditional four sub-stages
(early 初期 / mid 中期 / late 后期 / peak 大圆满), so breakthroughs land often, not once
a month.

1. 炼气 Qi Condensation
2. 筑基 Foundation Establishment
3. 金丹 Golden Core
4. 元婴 Nascent Soul
5. 化神 Soul Transformation
6. 渡劫 Tribulation
7. 飞升 Ascension

Thresholds are pure data (a `[qi, realm, stage]` table). Tune the curve so an active
learner breaks through a sub-stage every few days early on, slowing at the higher realms.
Because it is all derived from `totalXp()`, no new stored state is needed for Phase 1.

## Phased plan

### Phase 1 — Realm progression + the breakthrough moment (~120k tokens) — DONE
The core loop and the direct answer to "what happens when the bar fills."

1. Add a pure `realmFor(qi)` deriving realm + sub-stage + progress-to-next from a
   thresholds table. No stored state.
2. Reskin the path header (`paintPath`, `app.js:117`): show realm name + sub-stage, and a
   breakthrough bar (qì toward next stage) beside the existing daily-goal ring.
3. On the lesson-done screen (`js/lesson.js:805-835`): compare qì before/after, and if a
   threshold was crossed, show a **breakthrough banner** naming the new realm. This is the
   payoff moment. Use the CSS-only glow/aura effect from the assets research — no library.

**Acceptance:** finishing a lesson that crosses a threshold shows a breakthrough; the path
header always reflects current realm.

### Phase 2 — Silly collectibles (~150k tokens) — DONE
Cosmetic rewards in a new `gamify` blob, added via an additive v4 store migration that
mirrors the existing v1→v2→v3 additive pattern (`js/store.js:53-78`). Ranked by
payoff-per-effort:

1. **道号 (Dao titles)** ✅ — earned nicknames, text only, cheapest. e.g. "Sweeper of
   Radicals," "The Tone-Deaf Immortal," "Stroke-Order Sovereign," "Pinyin Ghost." Unlocked
   by milestones (realm reached, streak length, N words seen). Built in `js/rewards.js`
   (`TITLES`).
2. **丹药 (pills)** ✅ — a collection grid; the streak "furnace" brews one pill per
   milestone. Flavor text only ("Nine-Turn Tone Pill: +0 to anything, tastes of
   licorice"). Built in `js/rewards.js` (`PILLS`).
3. **功法 (techniques)** ✅ — technique names unlocked by exposure counts, from
   `store.exposure`. Gated on `drills` (lifetime retrievals) and `mastered` (cards past
   `LIFETIME_TARGET`). Built in `js/rewards.js` (`TECHNIQUES`); stored in
   `gamify.techniques` (additive, no version bump).
4. **灵宠 (a spirit pet)** ✅ — a dragon companion that ascends by realm band, egg to
   true dragon (灵卵 → 灵蛇 → 蛟 → 螭龙 → 真龙). Stage derived from realm, no stored
   state. Built in `js/pets.js`; art is Lorc's game-icons.net icons under CC BY 3.0
   (recoloured to `currentColor`), attributed in `CREDITS.md`.

The collection lives on the **Hoard** screen (link on the path header): the pet with its
ascension ladder, then titles, pills, and techniques as earned/locked lists.

**Acceptance:** ✅ milestones grant titles/pills/techniques; the Hoard lists earned vs
locked and shows the pet's current stage.

### Phase 3 — Streak as cultivation ritual (~40k tokens) — DONE
Reframe streak + freeze in-theme with no mechanic change: a missed day risks **qi
deviation (走火入魔)**, and the freeze is a **talisman** that auto-burns to save the streak,
with a small in-theme toast the next session. Language + one notification only.

Built: `bumpStreak` (`js/store.js`) leaves an `omen` on the streak — `talisman` when a
freeze burns to bridge a missed day, `deviation` when a real streak scatters (a first-ever
start is not flagged). `talismans()` exposes the freeze count; `takeStreakOmen()` reads and
clears the omen so a session announces it once. The path header shows a cinnabar 符 chip
(`#streak-talisman`, `--seal`) when a talisman is in hand, and the boot IIFE (`app.js`)
toasts the omen after `go('path')`. No thresholds or freeze mechanics changed.

### Phase 4 — Spirit stones + cosmetics shelf (~80k tokens, optional)
A soft currency (灵石 spirit stones) banked from practice, spendable only on cosmetics:
UI themes (a jade/ink "sect robes" skin), pet variants. Gives the accumulating numbers a
sink without any pay-to-win, since everything bought is cosmetic.

## Why this is safe to build

- **All rewards are cosmetic.** The gamify layer only *reads* XP/exposure/streak; it never
  writes to `cards` or changes FSRS scheduling. Nothing to balance.
- **One additive migration.** New state (`titles`, `pills`, `techniques`, `pet`, `stones`)
  lives in a `gamify` blob under a v4 bump; old saves keep working untouched, matching the
  established migration style.
- **Offline-clean.** No runtime CDN. Any icons/patterns are vendored into the repo and
  cached by `sw.js`, with attribution recorded (see assets research — the repo is public).

## Effort summary

| Phase | Scope | Tokens |
|---|---|---|
| 1 | Realm progression + breakthrough | ~120k |
| 2 | Silly collectibles | ~150k |
| 3 | Streak reskin | ~40k |
| 4 | Spirit stones + cosmetics (optional) | ~80k |

Phases 1–2 (~270k) deliver the fun on their own. Full arc ~390k across several sessions.

## Open questions — resolved

- Curve shape for realm thresholds: **fast-then-slow** — an active learner breaks through
  every few days early on, slowing higher up (`REALM_TABLE` in `js/course.js`).
- Breakthrough celebration: a **banner on the done screen**, not an interrupting modal.
- Title flavor: **bilingual** — 中文 shown with its English gloss.
